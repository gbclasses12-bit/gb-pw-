import React, { useEffect, useState } from 'react';
import { fetchSubjectInfo } from '../lib/api';
import { type ChapterItem } from '../lib/constants';
import { useRouter, useSearchParams } from '../lib/router';

export function SubjectChaptersPage({
  batchId,
  subjectId,
}: {
  batchId: string;
  subjectId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setPage(1);
    setChapters([]);
    setHasMore(true);
  }, [batchId, subjectId]);

  useEffect(() => {
    if (!batchId || !subjectId) return;
    let cancelled = false;
    (async () => {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      setError('');

      try {
        const res = await fetchSubjectInfo(batchId, subjectId, page);
        const raw: ChapterItem[] = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (cancelled) return;
        setChapters((prev) => (page === 1 ? raw : [...prev, ...raw]));
        setHasMore(raw.length > 0 && raw.length >= 10);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chapters');
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
  }, [batchId, subjectId, page]);

  const buildTopicUrl = (slug: string, chapterId?: string) => {
    const q = new URLSearchParams();
    const bsId = searchParams.get('batchSubjectId');
    const sId = searchParams.get('subjectId');
    if (bsId) q.set('batchSubjectId', bsId);
    if (sId) q.set('subjectId', sId);
    if (chapterId) q.set('chapterId', chapterId);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return `/study/batches/${batchId}/subjects/${subjectId}/subject-topics/${slug || chapterId}${qs}`;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6 lg:col-span-2">
        <div className="bg-background border divshadow rounded-lg p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h1 className="text-2xl font-bold capitalize">
              {decodeURIComponent(subjectId).replace(/-/g, ' ')} — Chapters
            </h1>
            <button
              type="button"
              onClick={() => router.push(buildTopicUrl('all'))}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-[#7567ee] hover:text-white transition-colors"
            >
              View All Lectures
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <article
                  key={i}
                  aria-hidden="true"
                  className="rounded-xl border bg-background p-4"
                >
                  <div className="border-l-4 border-indigo-400 pl-3 space-y-3">
                    <div className="skeleton-shimmer h-5 w-3/4 rounded" />
                    <div className="skeleton-shimmer h-4 w-1/2 rounded" />
                  </div>
                </article>
              ))
            ) : chapters.length === 0 ? (
              <div className="rounded-lg bg-muted/60 p-7 text-center text-sm text-muted-foreground lg:col-span-2">
                No chapters are available for this subject.
              </div>
            ) : (
              chapters.map((ch) => (
                <article
                  key={ch._id}
                  onClick={() => router.push(buildTopicUrl(ch.slug, ch._id))}
                  className="cursor-pointer rounded-xl border bg-background p-4 transition hover:shadow-md divshadow"
                >
                  <div className="rounded border-l-4 border-indigo-400 pl-3">
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{ch.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {ch.videos ?? 0} Videos <span className="mx-1">|</span> {ch.exercises ?? 0}{' '}
                      Exercises <span className="mx-1">|</span> {ch.notes ?? 0} Notes
                    </p>
                  </div>
                </article>
              ))
            )}
          </div>

          {hasMore && !loading && chapters.length > 0 && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => !loadingMore && hasMore && setPage((p) => p + 1)}
                disabled={loadingMore}
                className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-foreground/20"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}

          {error && <div className="mt-4 text-center font-semibold text-red-600">{error}</div>}
        </div>
      </div>
    </div>
  );
}
