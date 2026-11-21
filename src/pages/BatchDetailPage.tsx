import React, { useEffect, useState } from 'react';
import { Bell, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { BatchCard } from '../components/BatchCard';
import { fetchBatchInfo, fetchTodaysSchedule, fetchUserDetailsList } from '../lib/api';
import {
  DEFAULT_SUBJECT_ICON,
  DESCRIPTION_HEADER_BG,
  STUDY_OFFERING_ICONS,
  TEACHER_PLACEHOLDER,
  type SubjectItem,
  type TeacherProfile,
} from '../lib/constants';
import { useRouter } from '../lib/router';

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

export function BatchDetailPage({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'batch' | 'announcement'>('batch');
  const [activeTab, setActiveTab] = useState<'classes' | 'live'>('classes');
  const [details, setDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [annPage, setAnnPage] = useState(1);
  const [annLoading, setAnnLoading] = useState(false);
  const [annHasMore, setAnnHasMore] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const [liveList, setLiveList] = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [teachers, setTeachers] = useState<Record<string, TeacherProfile>>({});

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    (async () => {
      setLoadingDetails(true);
      try {
        const res = await fetchBatchInfo(batchId, 'details');
        const payload = res?.data?.data ?? res?.data ?? res;
        if (!cancelled) setDetails(payload);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Error fetching batch details');
        }
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  useEffect(() => {
    if (viewMode !== 'announcement' || !batchId) return;
    let cancelled = false;
    (async () => {
      setAnnLoading(true);
      try {
        const res = await fetchBatchInfo(batchId, 'announcement', annPage);
        const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res?.announcements) ? res.announcements : [];
        if (cancelled) return;
        setAnnouncements((prev) => (annPage === 1 ? raw : [...prev, ...raw]));
        setAnnHasMore(raw.length >= 10);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Unable to load announcements');
      } finally {
        if (!cancelled) setAnnLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewMode, batchId, annPage]);

  useEffect(() => {
    if (activeTab !== 'live' || !details) return;
    let cancelled = false;
    (async () => {
      setLiveLoading(true);
      setLiveError('');
      try {
        const bid = String(details?.batchId || details?._id || batchId);
        const res = await fetchTodaysSchedule(bid, false);
        const list = Array.isArray(res?.data) ? res.data : [];
        if (cancelled) return;
        setLiveList(list);

        const tids: string[] = Array.from(
          new Set<string>(
            list
              .flatMap((e: any) => (Array.isArray(e?.teachers) ? e.teachers : e?.teachers ? [e.teachers] : []))
              .map((t: unknown) => extractId(t))
              .filter((id: string) => Boolean(id)),
          ),
        );
        if (tids.length > 0) {
          const td = await fetchUserDetailsList(tids);
          const map: Record<string, TeacherProfile> = {};
          (Array.isArray(td?.data) ? td.data : []).forEach((u: any) => {
            const id = extractId(u);
            if (!id) return;
            map[id] = {
              name: String(u?.name || ''),
              imageUrl: u?.imageId
                ? `${u.imageId.baseUrl || ''}${u.imageId.key || ''}`
                : String(u?.photoUrl || u?.PhotoUrl || ''),
            };
          });
          if (!cancelled) setTeachers(map);
        }
      } catch (err) {
        if (!cancelled) setLiveError(err instanceof Error ? err.message : "Unable to load today's schedule.");
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, details, batchId]);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: details?.name || 'GB STUDY Batch', url: shareUrl });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Batch link copied to clipboard!');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  const openLiveOrRecorded = (item: Record<string, any>) => {
    const st = getScheduleStatus(item);
    if (st.isCancelled) {
      toast.error('This class was cancelled.');
      return;
    }
    if (st.isUpcoming) {
      toast.error('This live class has not started yet.');
      return;
    }
    const urlType = String(item?.urlType || item?.scheduleType || 'penpencilvdo');
    const subj = item?.subjectId || item?.subject;
    const subjSlug = typeof subj === 'string' ? subj : subj?.slug || subj?._id || '';
    const params = new URLSearchParams({
      batchId: String(item?.batchId || details?.batchId || details?._id || batchId),
      SubjectId: String(subjSlug),
      ChildId: String(item?._id || ''),
      Type: urlType,
      isLocked: String(!!item?.isLocked),
      topicId: String(item?.slug || ''),
    });
    if (st.isLive) {
      router.push(`/live?${params.toString()}`);
      return;
    }
    params.set('VideoUrl', String(item?.videoDetails?.videoUrl || item?.url || ''));
    router.push(`/watch?${params.toString()}`);
  };

  if (loadingDetails && !details) {
    return (
      <div className="min-w-0 w-full max-w-full overflow-x-hidden px-3 py-5 sm:p-5">
        <div className="rounded-[20px_20px_0_0] border bg-background overflow-hidden">
          <div className="h-24 skeleton-shimmer" />
          <div className="p-4 flex gap-4">
            <div className="skeleton-shimmer h-6 w-24 rounded" />
            <div className="skeleton-shimmer h-6 w-24 rounded" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (viewMode === 'announcement') {
    return (
      <>
        {previewImg && (
          <div
            className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
            onClick={() => setPreviewImg(null)}
          >
            <div className="relative max-w-3xl w-full p-4 dark:border bg-background rounded divshadow">
              <img src={previewImg} alt="Preview" className="rounded-lg max-h-[80vh] mx-auto" />
            </div>
          </div>
        )}

        <div className="min-w-0 w-full max-w-full overflow-x-hidden px-3 py-5 sm:p-5">
          <div className="container mx-auto px-0 py-6">
            <div className="divshadow bg-background border rounded-lg p-6">
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setViewMode('batch')}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  ← Back to Batch
                </button>
                <h2 className="text-xl font-bold">📢 Announcements</h2>
              </div>

              {annLoading && annPage === 1 ? (
                <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2 lg:grid-cols-3">
                  <BatchCard isPlaceholder />
                  <BatchCard isPlaceholder />
                  <BatchCard isPlaceholder />
                </div>
              ) : announcements.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2 lg:grid-cols-3">
                    {announcements.map((item, idx) => {
                      const img = item?.attachment
                        ? `${item.attachment.baseUrl || ''}${item.attachment.key || ''}`
                        : '';
                      return (
                        <div
                          key={item?._id || idx}
                          className="no-scrollbar flex flex-col gap-4 overflow-y-scroll justify-between bg-background border p-4 divshadow max-h-96 rounded-lg"
                        >
                          <div className="flex items-start gap-4">
                            <img className="h-11 w-11" src={DEFAULT_SUBJECT_ICON} alt="Team Logo" />
                            <div>
                              <span className="text-sm font-bold">GB STUDY Team</span>
                              <p className="text-xs text-muted-foreground">
                                {item?.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-sm space-y-2">
                            <p className="break-words whitespace-pre-wrap">{item?.announcement}</p>
                          </div>
                          {img && (
                            <div onClick={() => setPreviewImg(img)} className="cursor-pointer">
                              <img src={img} alt="Announcement visual" className="w-full h-44 object-contain rounded" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {annHasMore && (
                    <div className="flex justify-center mt-4">
                      <button
                        type="button"
                        onClick={() => setAnnPage((p) => p + 1)}
                        disabled={annLoading}
                        className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
                      >
                        {annLoading ? 'Loading...' : 'Load More'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3 border rounded-md text-center">
                  <p className="p-4 text-muted-foreground">No announcements available.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  const resolvedBatchId = String(details?.batchId || details?._id || details?.slug || batchId);
  const subjects: SubjectItem[] = Array.isArray(details?.subjects) ? details.subjects : [];

  return (
    <div className="min-w-0 w-full max-w-full overflow-x-hidden px-3 py-5 sm:p-5">
      <div className="bg-background border rounded-[20px_20px_0_0]">
        <div className="rounded-[20px_20px_0_0] overflow-hidden">
          <div
            className="bg-no-repeat bg-cover bg-center container mx-auto px-4 py-6"
            style={{ backgroundImage: `url(${DESCRIPTION_HEADER_BG})` }}
          >
            {details ? (
              <h1 className="text-2xl font-bold text-white p-2">{details.name || details.batchName}</h1>
            ) : (
              <div className="h-8 w-64 bg-muted-foreground/30 animate-pulse rounded p-2" />
            )}
          </div>
        </div>

        <div className="flex min-w-0 w-full flex-wrap items-center justify-between gap-2 px-0 py-1 divshadow">
          <div className="mx-3 flex min-w-0 max-w-full gap-5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('classes')}
              className={`px-1 py-3 text-xs w-auto font-medium transition-all border-b-4 ${
                activeTab === 'classes'
                  ? 'border-[#7567ee] text-[#5a4bda] rounded dark:text-[#29ff94] dark:border-[#3dc280]'
                  : 'text-foreground border-transparent hover:text-[#7567ee] dark:hover:text-[#29ff94]'
              }`}
            >
              🎁 All Classes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={`px-1 py-3 text-xs w-auto font-medium transition-all border-b-4 ${
                activeTab === 'live'
                  ? 'border-[#7567ee] text-[#5a4bda] rounded dark:text-[#29ff94] dark:border-[#3dc280]'
                  : 'text-foreground border-transparent hover:text-[#7567ee] dark:hover:text-[#29ff94]'
              }`}
            >
              🔴 Live Classes
            </button>
          </div>

          <div className="flex items-center gap-2 text-foreground rounded-lg mx-3 sm:mx-5 py-1.5">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Batch</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAnnPage(1);
                setViewMode('announcement');
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              <span>Announcement</span>
              <span className="h-2 w-2 rounded-full bg-[#BF2734]" />
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'classes' && (
        <div className="container mx-auto min-w-0 max-w-full px-0 py-6">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <div className="divshadow min-w-0 max-w-full overflow-hidden rounded-lg border bg-background p-4 sm:p-6">
              <h2 className="text-2xl font-bold max-md:text-xl max-sm:text-base mb-4">Subjects</h2>
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {subjects.length > 0 ? (
                  subjects.map((sub) => {
                    const iconSrc = sub.imageId
                      ? `${sub.imageId.baseUrl || ''}${sub.imageId.key || ''}`
                      : DEFAULT_SUBJECT_ICON;
                    const q = new URLSearchParams();
                    const bsId = extractId(sub.batchSubjectId) || extractId(sub);
                    const sId =
                      extractId(sub.subjectId) ||
                      extractId((sub as any).subject?._id) ||
                      extractId((sub as any).subjectDetails?._id);
                    if (bsId) q.set('batchSubjectId', bsId);
                    if (sId) q.set('subjectId', sId);
                    const qs = q.toString() ? `?${q.toString()}` : '';

                    return (
                      <div
                        key={sub._id}
                        onClick={() =>
                          router.push(`/study/batches/${resolvedBatchId}/subjects/${sub.slug}${qs}`)
                        }
                        className="divshadow flex min-w-0 w-full items-center gap-3 overflow-hidden rounded-lg border bg-background p-3 transition-shadow hover:shadow-md cursor-pointer sm:p-4"
                      >
                        <div className="text-[#2a4365] text-xl flex-shrink-0">
                          <img
                            src={iconSrc}
                            alt={sub.subject}
                            width={40}
                            height={40}
                            className="w-10 h-10 object-contain"
                            onError={(e) => {
                              e.currentTarget.src = DEFAULT_SUBJECT_ICON;
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="block w-full truncate text-sm font-semibold text-foreground sm:text-base md:text-lg">
                            {sub.subject}
                          </p>
                          <p className="text-xs text-muted-foreground">{sub.tagCount ?? 0} Chapters</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="col-span-full text-sm text-muted-foreground py-6 text-center">
                    No subjects available in this batch yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'live' && (
        <div className="container mx-auto space-y-6 px-0 py-6">
          <section className="rounded-xl border bg-background p-4 divshadow sm:p-6">
            <h2 className="mb-4 text-lg font-semibold">Live Classes</h2>
            {liveError && (
              <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">{liveError}</div>
            )}
            <div className="flex gap-4 overflow-x-auto pb-2 sm:flex-wrap">
              {liveLoading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <article
                    key={idx}
                    aria-hidden="true"
                    className="w-[220px] min-w-[220px] rounded-md border bg-background p-3"
                  >
                    <div className="skeleton-shimmer h-28 w-full rounded" />
                    <div className="mt-3 flex justify-between gap-3">
                      <div className="skeleton-shimmer h-6 w-16 rounded" />
                      <div className="skeleton-shimmer h-4 w-20 rounded" />
                    </div>
                    <div className="skeleton-shimmer mt-3 h-4 w-full rounded" />
                  </article>
                ))
              ) : liveList.length === 0 ? (
                <div className="w-full rounded-lg bg-muted/60 p-7 text-center text-sm text-muted-foreground">
                  No live or recorded classes are scheduled today.
                </div>
              ) : (
                liveList.map((item, idx) => {
                  const st = getScheduleStatus(item);
                  const firstTeacher = Array.isArray(item?.teachers) ? item.teachers[0] : item?.teachers;
                  const tInfo = teachers[extractId(firstTeacher)];
                  const tImg =
                    tInfo?.imageUrl ||
                    (typeof firstTeacher === 'object' && firstTeacher?.imageId
                      ? `${firstTeacher.imageId.baseUrl || ''}${firstTeacher.imageId.key || ''}`
                      : '') ||
                    item?.videoDetails?.image ||
                    TEACHER_PLACEHOLDER;

                  return (
                    <button
                      key={item?._id || idx}
                      type="button"
                      onClick={() => openLiveOrRecorded(item)}
                      className="w-[240px] min-w-[240px] rounded-lg border bg-background p-3 text-left transition hover:shadow-md"
                    >
                      <div className="relative h-28 w-full rounded overflow-hidden bg-muted">
                        <img
                          src={tImg}
                          alt={tInfo?.name || 'Teacher'}
                          className="h-full w-full object-cover object-top"
                          onError={(e) => {
                            e.currentTarget.src = TEACHER_PLACEHOLDER;
                          }}
                        />
                        {st.isLive && (
                          <span className="absolute top-2 left-2 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            LIVE
                          </span>
                        )}
                        {!st.isCancelled && (
                          <img
                            src={STUDY_OFFERING_ICONS.playCircle}
                            alt=""
                            className="absolute bottom-2 right-2 h-6 w-6"
                          />
                        )}
                      </div>
                      <p className="mt-2.5 line-clamp-2 text-sm font-semibold">
                        {item?.topic || item?.subjectId?.name || 'Live Class'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(item?.startTime || 0).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
