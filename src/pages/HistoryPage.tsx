import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, History, Play } from 'lucide-react';
import { AttachmentsDrawer, extractAttachmentsFromSchedule } from '../components/NoteCard';
import {
  STUDY_OFFERING_ICONS,
  TEACHER_PLACEHOLDER,
  type HistoryEntry,
  type LectureAttachment,
} from '../lib/constants';
import { useRouter } from '../lib/router';
import { getStudyHistory } from '../lib/storage';

function formatWatchTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'History';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAttachments, setDrawerAttachments] = useState<LectureAttachment[]>([]);

  useEffect(() => {
    const sync = () => {
      setItems(getStudyHistory());
      setLoading(false);
    };
    sync();
    window.addEventListener('studyHistoryUpdated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('studyHistoryUpdated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    items.forEach((item) => {
      const key = formatDateGroup(item.watchedAt);
      map.set(key, [...(map.get(key) || []), item]);
    });
    return Array.from(map.entries());
  }, [items]);

  const openEntry = (entry: HistoryEntry) => {
    const route = String(entry.meta?.route || '');
    if (route) {
      router.push(route);
      return;
    }
    if (entry.url) {
      window.open(entry.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground relative">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold">History</h1>
            <p className="text-xs text-muted-foreground">Your recent study activity</p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 skeleton-shimmer rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="grid min-h-[55vh] place-items-center text-center">
            <div>
              <History className="mx-auto h-12 w-12 text-muted-foreground/60" />
              <h2 className="mt-4 text-lg font-semibold">No history yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Lectures, notes and DPP activity will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([dateLabel, entries]) => (
              <section key={dateLabel}>
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{dateLabel}</h2>
                <div className="grid grid-cols-1 gap-4">
                  {entries.map((item, idx) => {
                    const key = item._id || `${item.type}-${item.contentId}-${idx}`;
                    const time = formatWatchTime(item.watchedAt);

                    if (item.type === 'lecture') {
                      return (
                        <article
                          key={key}
                          className="rounded-2xl border bg-background p-4 shadow-sm transition hover:shadow-md"
                        >
                          <div className="flex items-center gap-4">
                            <img
                              src={item.thumbnail || TEACHER_PLACEHOLDER}
                              alt={item.title}
                              className="h-14 w-14 shrink-0 rounded-xl bg-muted object-cover"
                              onError={(e) => {
                                e.currentTarget.src = TEACHER_PLACEHOLDER;
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-muted-foreground">
                                Lecture {time ? `• ${time}` : ''}
                              </div>
                              <h3 className="truncate text-sm font-semibold sm:text-base">{item.title}</h3>
                              {item.subject && (
                                <p className="text-xs text-muted-foreground">{item.subject}</p>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2 sm:max-w-md sm:pl-[70px]">
                            <button
                              type="button"
                              onClick={() => openEntry(item)}
                              className="flex items-center justify-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium transition hover:bg-[#7567ee] hover:text-white"
                            >
                              <Play className="h-4 w-4" fill="currentColor" />
                              <span>Resume</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const sched = (item.meta?.schedule || null) as Record<string, any> | null;
                                setDrawerAttachments(extractAttachmentsFromSchedule(sched));
                                setDrawerOpen(true);
                              }}
                              className="rounded-md bg-muted px-4 py-2 text-sm font-medium transition hover:bg-muted/70"
                            >
                              Notes &amp; more
                            </button>
                          </div>
                        </article>
                      );
                    }

                    const isDppPdf = item.type === 'dpp-pdf';
                    return (
                      <article
                        key={key}
                        className="rounded-2xl border bg-background p-3 shadow-sm transition hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={isDppPdf ? STUDY_OFFERING_ICONS.dpp : STUDY_OFFERING_ICONS.notes}
                            alt={isDppPdf ? 'DPP PDF' : 'Notes'}
                            className={`h-[72px] w-[72px] shrink-0 rounded-xl object-contain ${
                              isDppPdf ? 'bg-amber-100' : 'bg-sky-100'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2 text-xs uppercase text-muted-foreground">
                              <span>{isDppPdf ? 'DPP PDF' : 'Notes'}</span>
                              {time && <span>• {time}</span>}
                            </div>
                            <h3 className="truncate text-sm font-semibold sm:text-base">{item.title}</h3>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEntry(item)}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium transition hover:bg-[#7567ee] hover:text-white"
                        >
                          <Eye className="h-4 w-4" />
                          <span>{isDppPdf ? 'View DPP PDF' : 'View Note'}</span>
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <AttachmentsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        attachments={drawerAttachments}
      />
    </main>
  );
}
