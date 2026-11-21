import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronRight, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { NoteCard, NoteCardSkeleton, extractAttachmentsFromSchedule } from '../components/NoteCard';
import { fetchAboutMeApi, fetchAllBatches, fetchTodaysSchedule, fetchUserDetailsList } from '../lib/api';
import {
  DESCRIPTION_HEADER_BG,
  STUDY_OFFERING_ICONS,
  TEACHER_PLACEHOLDER,
  type EnrolledBatch,
  type LectureAttachment,
  type TeacherProfile,
} from '../lib/constants';
import { useRouter } from '../lib/router';
import {
  getEnrolledBatches,
  getSelectedBatch,
  saveEnrolledBatches,
  saveSelectedBatch,
} from '../lib/storage';

function extractId(val: unknown): string {
  if (typeof val === 'string' || typeof val === 'number') return String(val);
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    return extractId(obj._id || obj.id);
  }
  return '';
}

function getScheduleStatus(schedule: Record<string, any>) {
  const status = String(schedule?.status || schedule?.lectureStatus || '').toUpperCase();
  const isCancelled = status === 'CANCELLED' || status === 'CANCELED';
  const start = new Date(schedule?.startTime || 0).getTime();
  const end = new Date(schedule?.endTime || 0).getTime();
  const now = Date.now();
  const isUpcoming = !isCancelled && Number.isFinite(start) && start > now && status !== 'LIVE';
  const isLive =
    !isCancelled &&
    (status === 'LIVE' || (Number.isFinite(start) && Number.isFinite(end) && now >= start && now <= end));
  return { isCancelled, isLive, isUpcoming };
}

function formatTimeRange(startIso?: string, endIso?: string): string {
  const fmt = (iso?: string) => {
    const d = new Date(iso || 0);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };
  return `${fmt(startIso)} - ${fmt(endIso)}`;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="h-full w-full text-[#6674f4] dark:text-[#60a5fa]">
      <rect width="48" height="48" rx="8" fill="white" />
      <rect x="8" y="11" width="32" height="30" rx="5" fill="currentColor" />
      <rect x="12" y="19" width="24" height="18" rx="2" fill="white" />
      <rect x="14" y="7" width="4" height="10" rx="2" fill="currentColor" />
      <rect x="30" y="7" width="4" height="10" rx="2" fill="currentColor" />
      <path
        d="M16 24H20M24 24H28M32 24H34M16 29H20M24 29H28M32 29H34M16 34H20M24 34H28"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BatchSelectorDrawer({
  open,
  batches,
  selectedBatch,
  onClose,
  onSelect,
}: {
  open: boolean;
  batches: EnrolledBatch[];
  selectedBatch: EnrolledBatch | null;
  onClose: () => void;
  onSelect: (b: EnrolledBatch) => void;
}) {
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState('');

  useEffect(() => {
    if (!open) return;
    setPickedId(selectedBatch?.batchId || batches[0]?.batchId || '');
    setQuery('');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, selectedBatch, batches, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? batches.filter((b) => (b.name || b.batchName || '').toLowerCase().includes(q)) : batches;
  }, [batches, query]);

  return (
    <div
      className={`fixed inset-0 z-[80] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close batch selector"
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Select your batch"
        className={`absolute inset-y-0 right-0 flex w-full max-w-[410px] flex-col border-l bg-background shadow-2xl transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
          <h2 className="font-semibold">Select your batch</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md transition hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search enrolled batches"
            className="mb-5 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />

          <section role="radiogroup" aria-label="Enrolled batches">
            <h3 className="mb-2 text-sm font-semibold">Enrolled Batches ({filtered.length})</h3>
            {filtered.length > 0 ? (
              <div className="overflow-hidden rounded-lg border bg-background divide-y">
                {filtered.map((batch) => {
                  const selected = batch.batchId === pickedId;
                  const label = batch.name || batch.batchName || 'Untitled Batch';
                  return (
                    <button
                      key={batch.batchId}
                      type="button"
                      onClick={() => setPickedId(batch.batchId)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                          selected ? 'border-[#7567ee] dark:border-[#29ff94]' : 'border-input'
                        }`}
                      >
                        {selected && <span className="h-3 w-3 rounded-full bg-[#7567ee] dark:bg-[#29ff94]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No enrolled batches match your search.
              </div>
            )}
          </section>
        </div>

        <div className="shrink-0 border-t bg-background p-4">
          <button
            type="button"
            onClick={() => {
              const found = batches.find((b) => b.batchId === pickedId);
              if (found) onSelect(found);
              onClose();
            }}
            disabled={!pickedId}
            className="h-11 w-full rounded-md bg-foreground text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </aside>
    </div>
  );
}

export function StudyPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<EnrolledBatch[]>([]);
  const [selectedBatch, setSelectedBatchState] = useState<EnrolledBatch | null>(null);
  const [booting, setBooting] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [schedules, setSchedules] = useState<Record<string, any>[]>([]);
  const [teachers, setTeachers] = useState<Record<string, TeacherProfile>>({});
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBooting(true);
      let list = getEnrolledBatches();
      try {
        const me = await fetchAboutMeApi(false).catch(() => null);
        const remote = Array.isArray(me?.enrolledBatches) ? me.enrolledBatches : [];
        if (remote.length > 0) {
          const map = new Map<string, EnrolledBatch>();
          [...remote, ...list].forEach((b: any) => {
            const bid = String(b?.batchId || b?._id || '');
            if (!bid) return;
            map.set(bid, {
              batchId: bid,
              name: String(b?.name || b?.batchName || 'Batch'),
              batchName: String(b?.batchName || b?.name || 'Batch'),
              batchImage: String(b?.batchImage || b?.previewImage || ''),
              language: String(b?.language || ''),
              startDate: String(b?.startDate || ''),
              endDate: String(b?.endDate || ''),
              batchPrice: Number(b?.batchPrice || 0),
              byName: String(b?.byName || ''),
            });
          });
          list = Array.from(map.values());
          saveEnrolledBatches(list);
        } else {
          // Verify/preload popular batch for quick discovery even if AboutMe returned empty
          const all = await fetchAllBatches('1').catch(() => null);
          const raw = all?.batches || all?.data || [];
          if (list.length === 0 && Array.isArray(raw) && raw.length > 0) {
            const first = raw[0];
            const fallbackBatch: EnrolledBatch = {
              batchId: String(first.batchId || first._id),
              name: String(first.batchName || first.name || 'Explore Batches'),
              batchName: String(first.batchName || first.name || 'Explore Batches'),
            };
            if (!cancelled) setSelectedBatchState(fallbackBatch);
          }
        }
      } catch {
        // ignore
      }

      if (cancelled) return;
      setBatches(list);
      const saved = getSelectedBatch();
      if (saved && list.some((b) => b.batchId === saved.batchId)) {
        setSelectedBatchState(saved);
      } else if (list[0]) {
        setSelectedBatchState(list[0]);
      }
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedBatch?.batchId) return;
    let cancelled = false;
    (async () => {
      setLoadingSchedule(true);
      setScheduleError('');
      try {
        const res = await fetchTodaysSchedule(selectedBatch.batchId, false);
        const list = Array.isArray(res?.data) ? res.data : [];
        if (cancelled) return;
        setSchedules(list);

        const teacherIds: string[] = Array.from(
          new Set<string>(
            list
              .flatMap((s: any) => (Array.isArray(s.teachers) ? s.teachers : s.teachers ? [s.teachers] : []))
              .map((t: unknown) => extractId(t))
              .filter((id: string) => Boolean(id)),
          ),
        );
        if (teacherIds.length > 0) {
          const td = await fetchUserDetailsList(teacherIds);
          const map: Record<string, TeacherProfile> = {};
          (Array.isArray(td?.data) ? td.data : []).forEach((u: any) => {
            const id = extractId(u);
            if (!id) return;
            const img = u?.imageId
              ? `${u.imageId.baseUrl || ''}${u.imageId.key || ''}`
              : String(u?.photoUrl || u?.PhotoUrl || '');
            map[id] = { name: String(u?.name || ''), imageUrl: img };
          });
          if (!cancelled) setTeachers(map);
        }
      } catch {
        if (!cancelled) {
          setSchedules([]);
          setScheduleError('');
        }
      } finally {
        if (!cancelled) setLoadingSchedule(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBatch]);

  const upcomingEvents = useMemo(() => schedules.slice(0, 4), [schedules]);
  const todaysNotes = useMemo<LectureAttachment[]>(() => {
    const items = schedules.flatMap((s) => extractAttachmentsFromSchedule(s));
    return items.filter((i) => i.kind === 'note' || i.kind === 'dpp-pdf').slice(0, 6);
  }, [schedules]);

  const allClassesHref = selectedBatch ? `/study/batches/${selectedBatch.batchId}` : '/study/batches';
  const weeklyHref = selectedBatch
    ? `/weekly-schedule?batch_id=${encodeURIComponent(selectedBatch.batchId)}`
    : '';

  const openScheduleItem = (item: Record<string, any>) => {
    const st = getScheduleStatus(item);
    if (st.isCancelled) {
      toast.error('This class was cancelled.');
      return;
    }
    if (st.isUpcoming) {
      toast.error('This live class has not started yet.');
      return;
    }
    const batchId = String(item?.batchId || selectedBatch?.batchId || '');
    const childId = String(item?._id || '');
    const subj = item?.subject || item?.subjectId;
    const subjectSlug =
      typeof subj === 'object' ? String(subj?.slug || subj?._id || '') : String(subj || '');
    if (!batchId || !childId) {
      toast.error('This class is missing video details.');
      return;
    }
    const params = new URLSearchParams({
      batchId,
      SubjectId: subjectSlug,
      ChildId: childId,
      Type: String(item?.urlType || item?.scheduleType || 'penpencilvdo'),
      topicId: String(item?.slug || ''),
    });
    if (st.isLive) {
      router.push(`/live?${params.toString()}`);
      return;
    }
    params.set('VideoUrl', String(item?.videoDetails?.videoUrl || item?.url || ''));
    params.set('isLocked', String(!!item?.isLocked));
    router.push(`/watch?${params.toString()}`);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-muted/20 pb-12">
      <div className="container mx-auto w-full max-w-[1180px] space-y-5 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-7">
        {/* Hero Batch Header */}
        <section
          className="relative isolate overflow-hidden rounded-xl border border-white/10 bg-[#20262c] bg-cover bg-center px-5 py-6 text-white shadow-[0_14px_42px_rgba(15,23,42,0.18)] sm:px-8 sm:py-7"
          style={{ backgroundImage: `url(${DESCRIPTION_HEADER_BG})` }}
        >
          <div className="relative flex min-h-[72px] items-center justify-between gap-5">
            <div className="min-w-0">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
                Your batch
              </p>
              {booting ? (
                <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
              ) : selectedBatch ? (
                <button
                  type="button"
                  onClick={() => (batches.length ? setDrawerOpen(true) : router.push('/study/batches'))}
                  className="group flex max-w-full items-center gap-2 text-left text-xl font-bold sm:text-2xl"
                >
                  <span className="max-w-[235px] truncate sm:max-w-[560px]">
                    {selectedBatch.name || selectedBatch.batchName}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push('/study/batches')}
                  className="text-xl font-bold hover:underline sm:text-2xl"
                >
                  Explore a batch
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => (batches.length ? setDrawerOpen(true) : router.push('/study/batches'))}
              aria-label="Open batch selector"
              className="hidden h-10 w-10 place-items-center rounded-full text-white/85 hover:bg-white/10 sm:grid"
            >
              <ChevronDown className="h-6 w-6" />
            </button>
          </div>
        </section>

        {/* Batch Offerings */}
        <section className="rounded-[24px] border border-border/70 bg-background/90 p-4 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7567ee]">
              Start learning
            </p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl">Batch Offerings</h1>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => router.push(allClassesHref)}
              disabled={booting}
              className="group flex min-h-[76px] w-full items-center gap-3 rounded-xl bg-background px-4 py-3 text-left shadow-[0_6px_18px_rgba(15,23,42,0.05)] ring-1 ring-black/[0.02] transition hover:shadow-md active:scale-[0.985] disabled:opacity-55"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center p-0.5">
                <img src={STUDY_OFFERING_ICONS.allClasses} alt="" className="h-full w-full object-contain" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium sm:text-base">All Classes</span>
                <span className="block truncate text-xs text-muted-foreground">
                  Subjects, chapters and lectures
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/45" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (!weeklyHref) {
                  toast.error('Select a batch first.');
                  return;
                }
                router.push(weeklyHref);
              }}
              disabled={!selectedBatch}
              className="group flex min-h-[76px] w-full items-center gap-3 rounded-xl bg-background px-4 py-3 text-left shadow-[0_6px_18px_rgba(15,23,42,0.05)] ring-1 ring-black/[0.02] transition hover:shadow-md active:scale-[0.985] disabled:opacity-55"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center p-0.5">
                <CalendarIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium sm:text-base">Weekly Schedule</span>
                <span className="block truncate text-xs text-muted-foreground">
                  See classes and notes by day
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/45" />
            </button>
          </div>
        </section>

        {/* Upcoming Events */}
        <section className="rounded-[24px] border border-border/70 bg-background/90 p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <h2 className="text-xl font-bold sm:text-2xl">Upcoming Events</h2>
            {!loadingSchedule && upcomingEvents.length > 0 && (
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#7567ee]/10 px-1.5 text-xs font-bold text-[#7567ee]">
                {upcomingEvents.length}
              </span>
            )}
          </div>

          {loadingSchedule ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex min-h-[104px] items-center gap-3 rounded-2xl border border-border/70 bg-background p-3 shadow-sm"
                >
                  <div className="skeleton-shimmer h-[72px] w-[72px] shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="skeleton-shimmer h-3 w-28 rounded" />
                    <div className="skeleton-shimmer h-4 w-2/3 rounded" />
                    <div className="skeleton-shimmer h-3 w-5/6 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : scheduleError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
              {scheduleError}
            </div>
          ) : upcomingEvents.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {upcomingEvents.map((ev, idx) => {
                const st = getScheduleStatus(ev);
                const firstTeacher = Array.isArray(ev.teachers) ? ev.teachers[0] : ev.teachers;
                const tid = extractId(firstTeacher);
                const tInfo = teachers[tid];
                const tImg =
                  tInfo?.imageUrl ||
                  (typeof firstTeacher === 'object' && firstTeacher?.imageId
                    ? `${firstTeacher.imageId.baseUrl || ''}${firstTeacher.imageId.key || ''}`
                    : '') ||
                  ev?.videoDetails?.image ||
                  TEACHER_PLACEHOLDER;
                const subjName = ev?.subjectId?.name || ev?.subject?.name || 'Class';

                return (
                  <button
                    key={String(ev?._id || idx)}
                    type="button"
                    onClick={() => openScheduleItem(ev)}
                    disabled={st.isCancelled}
                    className="group relative flex min-h-[104px] w-full items-center gap-3 overflow-hidden rounded-2xl border border-border/70 bg-background p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#7567ee]/50 hover:shadow-md disabled:opacity-65"
                  >
                    <span className="relative h-[72px] w-[72px] shrink-0 rounded-xl bg-[#dff8e8]">
                      <img
                        src={tImg}
                        alt={tInfo?.name || 'Teacher'}
                        className="h-full w-full rounded-xl object-cover object-top"
                        onError={(e) => {
                          e.currentTarget.src = TEACHER_PLACEHOLDER;
                        }}
                      />
                      {!st.isCancelled && (
                        <img
                          src={STUDY_OFFERING_ICONS.playCircle}
                          alt=""
                          className="absolute -bottom-1 -right-1 h-6 w-6 drop-shadow-sm"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate font-semibold text-[#7567ee]">{subjName}</span>
                        {st.isLive && (
                          <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            LIVE
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block truncate text-sm font-semibold text-foreground">
                        {ev?.topic || ev?.videoDetails?.name || 'Lecture'}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {formatTimeRange(ev?.startTime, ev?.endTime)}
                        {tInfo?.name ? ` • ${tInfo.name}` : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-9 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-[#7567ee]" />
              <p className="mt-3 font-semibold">No classes scheduled today</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open All Classes or check another batch to start studying.
              </p>
            </div>
          )}

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => router.push(allClassesHref)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#7567ee] px-7 py-2.5 text-sm font-semibold text-[#7567ee] transition hover:bg-[#7567ee] hover:text-white"
            >
              <span>Open Full Batch</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Today's Notes */}
        {(loadingSchedule || todaysNotes.length > 0) && (
          <section className="min-w-0 overflow-hidden rounded-[24px] border border-border/70 bg-background/90 p-4 shadow-sm sm:p-6">
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7567ee]">
                Shared today
              </p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">Today&apos;s Notes</h2>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {loadingSchedule
                ? Array.from({ length: 3 }).map((_, i) => <NoteCardSkeleton key={i} />)
                : todaysNotes.map((n) => <NoteCard key={n.id} note={n} />)}
            </div>
          </section>
        )}

        {/* My Study Zone */}
        <section className="rounded-[24px] border border-border/70 bg-background/90 p-4 shadow-sm sm:p-6">
          <div className="mb-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7567ee]">
              Quick access
            </p>
            <h2 className="mt-1 text-xl font-bold sm:text-2xl">My Study Zone</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'My Batches',
                desc: 'View all the batches you are enrolled in',
                icon: STUDY_OFFERING_ICONS.myBatches,
                onClick: () => router.push('/study/mybatches'),
              },
              {
                title: 'Explore Batches',
                desc: 'Browse classes and discover more batches',
                icon: STUDY_OFFERING_ICONS.allClasses,
                onClick: () => router.push('/study/batches'),
              },
              {
                title: 'Watch History',
                desc: 'Resume your recent lectures and class notes',
                customIcon: <Calendar className="h-6 w-6 text-[#7567ee]" />,
                onClick: () => router.push('/history'),
              },
            ].map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={item.onClick}
                className="group relative min-h-[142px] overflow-hidden rounded-2xl border border-border/70 bg-background p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#7567ee]/50 hover:shadow-md"
              >
                <span className="mb-4 flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#f2f0ff] p-1.5">
                    {item.customIcon || (
                      <img src={item.icon} alt="" className="h-full w-full object-contain" />
                    )}
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-muted/70">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </span>
                </span>
                <span className="block text-base font-bold">{item.title}</span>
                <span className="mt-1.5 block line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {item.desc}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <BatchSelectorDrawer
        open={drawerOpen}
        batches={batches}
        selectedBatch={selectedBatch}
        onClose={() => setDrawerOpen(false)}
        onSelect={(b) => {
          setSelectedBatchState(b);
          saveSelectedBatch(b);
        }}
      />
    </div>
  );
}
