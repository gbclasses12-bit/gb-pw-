import React, { useEffect, useState } from 'react';
import { Calendar, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { fetchTodaysSchedule } from '../lib/api';
import { STUDY_OFFERING_ICONS, TEACHER_PLACEHOLDER } from '../lib/constants';
import { useRouter, useSearchParams } from '../lib/router';
import { getSelectedBatch } from '../lib/storage';

export function WeeklySchedulePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = searchParams.get('batch_id') || getSelectedBatch()?.batchId || '';
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!batchId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchTodaysSchedule(batchId, false);
        if (!cancelled) setClasses(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load schedule');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const openClass = (item: any) => {
    const subj = item?.subjectId || item?.subject;
    const subjSlug = typeof subj === 'string' ? subj : subj?.slug || subj?._id || '';
    const params = new URLSearchParams({
      batchId: String(item?.batchId || batchId),
      SubjectId: String(subjSlug),
      ChildId: String(item?._id || ''),
      Type: String(item?.urlType || 'penpencilvdo'),
      VideoUrl: String(item?.videoDetails?.videoUrl || item?.url || ''),
      topicId: String(item?.slug || ''),
    });
    router.push(`/watch?${params.toString()}`);
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="rounded-xl border bg-background p-6 divshadow">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="h-6 w-6 text-[#7567ee]" />
          <div>
            <h1 className="text-xl font-bold">Class Schedule</h1>
            <p className="text-xs text-muted-foreground">Today&apos;s scheduled classes for your batch</p>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-shimmer h-24 rounded-xl" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No classes scheduled right now. Open All Classes inside your batch to browse recorded lectures.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {classes.map((item, idx) => (
              <button
                key={item?._id || idx}
                type="button"
                onClick={() => openClass(item)}
                className="flex items-center gap-3 rounded-xl border bg-background p-3 text-left transition hover:shadow-md"
              >
                <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-muted">
                  <img
                    src={item?.videoDetails?.image || TEACHER_PLACEHOLDER}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = TEACHER_PLACEHOLDER;
                    }}
                  />
                  <img
                    src={STUDY_OFFERING_ICONS.playCircle}
                    alt=""
                    className="absolute bottom-1 right-1 h-5 w-5"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#7567ee]">
                    {item?.subjectId?.name || item?.subject?.name || 'Lecture'}
                  </p>
                  <p className="truncate text-sm font-semibold">{item?.topic || 'Class'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item?.startTime
                      ? new Date(item.startTime).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </p>
                </div>
                <PlayCircle className="h-5 w-5 text-[#7567ee] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
