import React, { useEffect, useState } from 'react';
import {
  Clock,
  Download,
  Eye,
  FileText,
  FolderOpen,
  ListChecks,
  Play,
  PlayCircle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { NoteCard, NoteCardSkeleton, extractAttachmentsFromSchedule, resolveAttachmentPdfUrl } from '../components/NoteCard';
import { fetchScheduleApi, fetchSubjectInfo, fetchTopicInfo, fetchUserDetailsList } from '../lib/api';
import {
  STUDY_OFFERING_ICONS,
  TEACHER_PLACEHOLDER,
  type ChapterItem,
  type LectureAttachment,
  type TeacherProfile,
} from '../lib/constants';
import { useRouter, useSearchParams } from '../lib/router';

type ContentTab = 'videos' | 'dpps' | 'notes' | 'DppNotes' | 'DppVideos';

const TABS: { label: string; value: ContentTab }[] = [
  { label: 'Lectures', value: 'videos' },
  { label: 'DPPs', value: 'dpps' },
  { label: 'Notes', value: 'notes' },
  { label: 'DPP PDFs', value: 'DppNotes' },
  { label: 'DPP Videos', value: 'DppVideos' },
];

function formatDuration(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const mins = Math.max(1, Math.round(raw / 60));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
  }
  const s = String(raw || '').trim();
  if (/^\d+:\d{2}:\d{2}$/.test(s)) {
    const [hh, mm, ss] = s.split(':').map(Number);
    return formatDuration(hh * 3600 + mm * 60 + ss);
  }
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [mm, ss] = s.split(':').map(Number);
    return formatDuration(mm * 60 + ss);
  }
  return s || '—';
}

function extractId(val: unknown): string {
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return extractId(obj._id || obj.id);
  }
  return '';
}

function formatTopicTitle(slug: string): string {
  try {
    return decodeURIComponent(slug)
      .replace(/-+\d+$/, '')
      .replace(/-+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return 'Topic Content';
  }
}

export function TopicsPage({
  batchId,
  subjectId,
  topicId,
}: {
  batchId: string;
  subjectId: string;
  topicId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ContentTab>('videos');
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [teachers, setTeachers] = useState<Record<string, TeacherProfile>>({});

  // Attachments modal state
  const [selectedLecture, setSelectedLecture] = useState<Record<string, any> | null>(null);
  const [attLoading, setAttLoading] = useState(false);
  const [attError, setAttError] = useState('');

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [activeTab, batchId, subjectId, topicId]);

  useEffect(() => {
    if (!batchId || !subjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const list: ChapterItem[] = [];
        const seen = new Set<string>();
        for (let p = 1; p <= 20; p += 1) {
          const res = await fetchSubjectInfo(batchId, subjectId, p);
          const raw: ChapterItem[] = Array.isArray(res?.data) ? res.data : [];
          if (raw.length === 0) break;
          const prevSize = seen.size;
          raw.forEach((c) => {
            const key = String(c._id || c.slug || '');
            if (key && !seen.has(key)) {
              seen.add(key);
              list.push(c);
            }
          });
          if (seen.size === prevSize) break;
        }
        if (!cancelled) setChapters(list);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId, subjectId]);

  useEffect(() => {
    if (!batchId || !subjectId || !topicId) return;
    let cancelled = false;
    (async () => {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      setError('');

      try {
        const res = await fetchTopicInfo(batchId, subjectId, topicId, activeTab, page);
        const list: any[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (cancelled) return;
        setItems((prev) => (page === 1 ? list : [...prev, ...list]));
        setHasMore(list.length > 0 && list.length >= 10);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load content';
          setError(msg);
          if (page === 1) setItems([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, page, batchId, subjectId, topicId]);

  useEffect(() => {
    if (activeTab !== 'videos' || items.length === 0) return;
    const ids = Array.from(
      new Set(
        items
          .flatMap((it) => (Array.isArray(it?.teachers) ? it.teachers : it?.teachers ? [it.teachers] : []))
          .map(extractId),
      ),
    ).filter((id) => id && teachers[id] === undefined);

    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchUserDetailsList(ids);
        const data = Array.isArray(res?.data) ? res.data : [];
        const map: Record<string, TeacherProfile> = {};
        ids.forEach((id) => {
          map[id] = { name: '', imageUrl: '' };
        });
        data.forEach((u: any) => {
          const id = extractId(u);
          if (!id) return;
          map[id] = {
            name: String(u?.name || ''),
            imageUrl: u?.imageId
              ? `${u.imageId.baseUrl || ''}${u.imageId.key || ''}`
              : String(u?.photoUrl || u?.PhotoUrl || ''),
          };
        });
        if (!cancelled) setTeachers((prev) => ({ ...prev, ...map }));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, items, teachers]);

  const watchVideo = (item: Record<string, any>) => {
    const params = new URLSearchParams({
      batchId,
      SubjectId: subjectId,
      ChildId: String(item?._id || ''),
      Type: String(item?.urlType || 'penpencilvdo'),
      VideoUrl: String(item?.videoDetails?.videoUrl || item?.videoDetails?.embedCode || item?.url || ''),
      isLocked: String(!!item?.isLocked),
      topicId: String(topicId || ''),
    });
    router.push(`/watch?${params.toString()}`);
  };

  const openAttachmentsModal = async (lecture: Record<string, any>) => {
    setSelectedLecture(lecture);
    setAttLoading(true);
    setAttError('');

    const fetchSched = async (contentId: string) => {
      const res = await fetchScheduleApi(batchId, subjectId, contentId);
      const raw = res?.data?.data ?? res?.data;
      return Array.isArray(raw)
        ? raw.find((s: any) => String(s?._id || '') === contentId) || raw[0]
        : raw;
    };

    try {
      const detail = await fetchSched(String(lecture?._id || ''));
      if (!detail || typeof detail !== 'object') {
        throw new Error('No schedule details were returned');
      }
      const asList = (v: any) => (Array.isArray(v) ? v : v ? [v] : []);
      const linkedRaw = [
        ...asList(detail.dppScheduleId),
        ...asList(detail.dppScheduleIds),
        ...asList(detail.dppSchedules),
        ...asList(detail.scheduleIds),
        ...asList(detail.childSchedules),
      ];
      const linkedSchedules: any[] = [];
      const linkedIds = new Set<string>();
      linkedRaw.forEach((entry: any) => {
        if (entry && typeof entry === 'object') {
          if (entry.homeworkIds || entry.videoDetails || entry.exerciseIds || entry.urlType || entry.url) {
            linkedSchedules.push(entry);
          } else if (entry._id) {
            linkedIds.add(String(entry._id));
          }
        } else if (entry) {
          linkedIds.add(String(entry));
        }
      });
      linkedIds.delete(String(lecture?._id || ''));
      if (linkedIds.size > 0) {
        const fetched = await Promise.all(
          Array.from(linkedIds)
            .slice(0, 12)
            .map((id) => fetchSched(id).catch(() => null)),
        );
        fetched.forEach((d) => {
          if (d && typeof d === 'object') linkedSchedules.push(d);
        });
      }

      setSelectedLecture({
        ...lecture,
        ...detail,
        _id: lecture?._id || detail?._id,
        __linkedSchedules: linkedSchedules,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load attachments';
      setAttError(msg);
      toast.error(msg);
    } finally {
      setAttLoading(false);
    }
  };

  const openExternalUrl = (url: string, downloadName?: string) => {
    const a = document.createElement('a');
    a.href = url;
    if (downloadName) a.download = downloadName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleOpenAttachment = async (att: LectureAttachment, asDownload = false) => {
    try {
      const url = await resolveAttachmentPdfUrl(att);
      openExternalUrl(url, asDownload ? att.fileName || `${att.title}.pdf` : undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to open PDF');
    }
  };

  const renderVideoCard = (item: any, idx: number) => {
    const firstTeacher = Array.isArray(item?.teachers) ? item.teachers[0] : item?.teachers;
    const tInfo = teachers[extractId(firstTeacher)];
    const thumb =
      item?.videoDetails?.image ||
      tInfo?.imageUrl ||
      TEACHER_PLACEHOLDER;
    const title = item?.topic || item?.videoDetails?.name || item?.name || 'Lecture';
    const dur = formatDuration(item?.videoDetails?.duration);
    const dateStr = item?.date
      ? new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : '';

    return (
      <article
        key={item?._id || idx}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border bg-background p-4 divshadow transition hover:shadow-md"
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => watchVideo(item)}
            className="relative h-[72px] w-[124px] shrink-0 overflow-hidden rounded-xl bg-muted group"
          >
            <img
              src={thumb}
              alt={title}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.src = TEACHER_PLACEHOLDER;
              }}
            />
            <span className="absolute inset-0 bg-black/25 flex items-center justify-center group-hover:bg-black/40 transition-colors">
              <PlayCircle className="h-8 w-8 text-white drop-shadow" />
            </span>
            {dur !== '—' && (
              <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {dur}
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              {dateStr && <span>{dateStr}</span>}
              {tInfo?.name && <span>• {tInfo.name}</span>}
            </div>
            <h3
              onClick={() => watchVideo(item)}
              className="line-clamp-2 cursor-pointer text-sm sm:text-base font-semibold hover:text-[#7567ee] transition-colors"
            >
              {title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => watchVideo(item)}
            className="flex items-center justify-center gap-2 rounded-md bg-[#7567ee] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#5a4bda]"
          >
            <Play className="h-4 w-4" fill="currentColor" />
            <span>Watch</span>
          </button>
          <button
            type="button"
            onClick={() => openAttachmentsModal(item)}
            className="flex items-center justify-center gap-1.5 rounded-md border bg-muted/60 px-3 py-2 text-sm font-medium transition hover:bg-muted"
          >
            <FolderOpen className="h-4 w-4" />
            <span>Attachments</span>
          </button>
        </div>
      </article>
    );
  };

  const renderNoteItem = (item: any, idx: number) => {
    const hwList = Array.isArray(item?.homeworkIds) ? item.homeworkIds : [item];
    return hwList.map((hw: any, hIdx: number) => {
      const att = (Array.isArray(hw?.attachmentIds) && hw.attachmentIds[0]) || hw;
      const base = String(att?.baseUrl || '');
      const key = String(att?.key || '');
      const noteObj: LectureAttachment = {
        id: `${item?._id || idx}-${hw?._id || hIdx}`,
        kind: activeTab === 'DppNotes' ? 'dpp-pdf' : 'note',
        title: String(hw?.topic || item?.topic || att?.name || 'Study Material'),
        label: activeTab === 'DppNotes' ? 'DPP PDF' : 'Class Notes',
        url: base && key ? `${base}${key}` : '',
        fileName: String(att?.name || `${hw?.topic || 'Notes'}.pdf`),
        batchId,
        subjectId,
        pdfId: String(item?._id || hw?._id || ''),
        attachmentId: String(att?._id || ''),
      };
      return <NoteCard key={noteObj.id} note={noteObj} />;
    });
  };

  const renderDppCard = (item: any, idx: number) => {
    const quiz = item?.dppQuizDetails?.test;
    if (quiz) {
      return (
        <article
          key={item?._id || idx}
          className="flex items-center justify-between gap-4 rounded-2xl border bg-background p-4 divshadow"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={STUDY_OFFERING_ICONS.dpp}
              alt="DPP"
              className="h-14 w-14 shrink-0 rounded-xl bg-amber-100 object-contain"
            />
            <div className="min-w-0">
              <h3 className="truncate text-sm sm:text-base font-semibold">{quiz.name || item?.topic || 'DPP'}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {quiz.totalQuestions || 0} Questions | {quiz.totalMarks || 0} Marks
              </p>
            </div>
          </div>
          <span className="rounded-md bg-[#7567ee]/10 px-3 py-1.5 text-xs font-semibold text-[#7567ee]">
            Quiz
          </span>
        </article>
      );
    }
    return renderNoteItem(item, idx);
  };

  const modalAttachments = selectedLecture
    ? extractAttachmentsFromSchedule(selectedLecture)
    : [];

  return (
    <div className="min-w-0 w-full max-w-full px-3 py-5 sm:p-6">
      <div className="container mx-auto max-w-5xl space-y-5">
        <div className="rounded-xl border bg-background p-5 divshadow">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7567ee]">
                {formatTopicTitle(subjectId)}
              </p>
              <h1 className="mt-1 text-xl font-bold sm:text-2xl">{formatTopicTitle(topicId)}</h1>
            </div>

            {chapters.length > 0 && (
              <select
                value={topicId}
                onChange={(e) => {
                  const slug = e.target.value;
                  const qs = searchParams.toString();
                  router.push(
                    `/study/batches/${batchId}/subjects/${subjectId}/subject-topics/${slug}${
                      qs ? `?${qs}` : ''
                    }`,
                  );
                }}
                aria-label="Select Chapter"
                className="h-10 max-w-xs rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[#7567ee]"
              >
                <option value="all">All Lectures</option>
                {chapters.map((ch) => (
                  <option key={ch._id} value={ch.slug || ch._id}>
                    {ch.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mt-5 flex gap-5 overflow-x-auto border-b">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setActiveTab(t.value)}
                className={`relative whitespace-nowrap pb-3 text-[13px] font-medium transition-colors sm:text-sm ${
                  activeTab === t.value
                    ? 'text-[#7567ee]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                {activeTab === t.value && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[#7567ee]" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) =>
                activeTab === 'videos' || activeTab === 'DppVideos' ? (
                  <div key={i} className="h-24 rounded-2xl border p-4 flex items-center gap-4">
                    <div className="skeleton-shimmer h-16 w-28 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton-shimmer h-3 w-24 rounded" />
                      <div className="skeleton-shimmer h-4 w-2/3 rounded" />
                    </div>
                  </div>
                ) : (
                  <NoteCardSkeleton key={i} />
                ),
              )
            ) : (
              items.map((item, idx) => {
                if (activeTab === 'videos' || activeTab === 'DppVideos') {
                  return renderVideoCard(item, idx);
                }
                if (activeTab === 'dpps') {
                  return renderDppCard(item, idx);
                }
                return renderNoteItem(item, idx);
              })
            )}
          </div>

          {!loading && error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No content is available in this tab yet.
            </div>
          )}

          {hasMore && !loading && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={loadingMore}
                className="rounded-md border px-6 py-2 text-sm font-medium transition hover:bg-[#7567ee] hover:text-white disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lecture Attachments Modal */}
      {selectedLecture && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setSelectedLecture(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-xl bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-semibold">Attachments</h2>
              <button
                type="button"
                onClick={() => setSelectedLecture(null)}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="Close attachments"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="max-h-[75vh] space-y-6 overflow-y-auto p-5">
              {attLoading ? (
                <div className="space-y-4">
                  <div className="skeleton-shimmer h-4 w-20 rounded" />
                  <div className="skeleton-shimmer h-16 w-full rounded-lg" />
                  <div className="skeleton-shimmer h-4 w-16 rounded" />
                  <div className="skeleton-shimmer h-16 w-full rounded-lg" />
                </div>
              ) : (
                <>
                  {attError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {attError}
                    </div>
                  )}

                  {/* Notes */}
                  <section>
                    <h3 className="mb-3 text-sm font-semibold">NOTES</h3>
                    <div className="space-y-2">
                      {modalAttachments.filter((a) => a.kind === 'note').length > 0 ? (
                        modalAttachments
                          .filter((a) => a.kind === 'note')
                          .map((note) => (
                            <button
                              key={note.id}
                              type="button"
                              onClick={() => handleOpenAttachment(note)}
                              className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/50"
                            >
                              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                {note.title}
                              </span>
                              <Eye className="h-4 w-4 shrink-0" />
                            </button>
                          ))
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                          No notes are attached to this lecture.
                        </div>
                      )}
                    </div>
                  </section>

                  {/* DPP PDFs */}
                  <section>
                    <h3 className="mb-3 text-sm font-semibold">DPP PDFs</h3>
                    <div className="space-y-2">
                      {modalAttachments.filter((a) => a.kind === 'dpp-pdf').length > 0 ? (
                        modalAttachments
                          .filter((a) => a.kind === 'dpp-pdf')
                          .map((pdf) => (
                            <button
                              key={pdf.id}
                              type="button"
                              onClick={() => handleOpenAttachment(pdf, true)}
                              className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/50"
                            >
                              <FileText className="h-5 w-5 shrink-0 text-amber-600" />
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                {pdf.title}
                              </span>
                              <Download className="h-4 w-4 shrink-0" />
                            </button>
                          ))
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                          No DPP PDF is attached to this lecture.
                        </div>
                      )}
                    </div>
                  </section>

                  {/* DPP Quiz */}
                  {modalAttachments.filter((a) => a.kind === 'dpp-quiz').length > 0 && (
                    <section>
                      <h3 className="mb-3 text-sm font-semibold">DPP</h3>
                      <div className="space-y-2">
                        {modalAttachments
                          .filter((a) => a.kind === 'dpp-quiz')
                          .map((q) => (
                            <div
                              key={q.id}
                              className="flex w-full items-center gap-3 rounded-lg border p-3"
                            >
                              <ListChecks className="h-6 w-6 shrink-0 text-muted-foreground" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{q.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {q.totalQuestions || 0} Questions | {q.totalMarks || 0} Marks
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </section>
                  )}

                  {/* DPP Videos */}
                  {modalAttachments.filter((a) => a.kind === 'dpp-video').length > 0 && (
                    <section>
                      <h3 className="mb-3 text-sm font-semibold">DPP Videos</h3>
                      <div className="space-y-2">
                        {modalAttachments
                          .filter((a) => a.kind === 'dpp-video')
                          .map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => v.url && openExternalUrl(v.url)}
                              className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/50"
                            >
                              <PlayCircle className="h-8 w-8 shrink-0 text-[#7567ee]" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{v.title}</p>
                                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" /> Watch solution
                                </p>
                              </div>
                            </button>
                          ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
