import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { BatchCard } from '../components/BatchCard';
import { Carousel } from '../components/Carousel';
import { fetchAllBatches, searchBatchesApi } from '../lib/api';
import { type BatchItem } from '../lib/constants';
import { useSearchParams } from '../lib/router';

const FEATURED_ORDER = [
  'Yakeen 2027',
  'Yakeen 2.0 2027',
  'Earners',
  'Lakshya JEE 2027',
  'Lakshya NEET 2027',
  'Arjuna JEE 2027',
  'Arjuna NEET 2027',
  'Udaan 2027',
  'Neev 2027',
  'Uday 2027',
  'Parishram 2027',
];

const CAROUSEL_BANNERS = [
  {
    src: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/2cd05c71-3897-4e88-9c73-3e307e0dde03.jpg',
    alt: 'Slide 1',
  },
  {
    src: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/4f17deae-eab1-4b19-b5cb-2bb2291d60e5.jpg',
    alt: 'Slide 2',
  },
  {
    src: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/afeb7785-0e5e-4fc9-95e7-57b328032009.jpg',
    alt: 'Slide 3',
  },
];

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getSortRank(name: string): number {
  const n = normalizeName(name);
  const exact = FEATURED_ORDER.findIndex((f) => normalizeName(f) === n);
  if (exact !== -1) return exact;
  const partial = FEATURED_ORDER.findIndex((f) => n.includes(normalizeName(f)));
  return partial === -1 ? Number.MAX_SAFE_INTEGER : partial;
}

function mapBatch(raw: any): BatchItem {
  return {
    _id: String(raw?._id || raw?.id || ''),
    batchId: String(raw?.batchId || raw?._id || ''),
    batchName: String(raw?.batchName || raw?.name || ''),
    batchImage: String(raw?.batchImage || raw?.previewImage || ''),
    language: String(raw?.language || ''),
    template: String(raw?.template || raw?.type || 'NORMAL'),
    startDate: String(raw?.startDate || ''),
    endDate: String(raw?.endDate || ''),
    batchPrice: Number(raw?.batchPrice ?? raw?.feeTotal ?? 0),
    byName: String(raw?.byName || ''),
  };
}

function formatDateLabel(raw: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return raw;
}

export function BatchesPage() {
  const searchParams = useSearchParams();
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const msg = searchParams.get('toast');
    if (msg) toast.error(decodeURIComponent(msg));
  }, [searchParams]);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    setBatches([]);
  }, [debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const isSearching = debouncedQuery.trim() !== '';
        const res = isSearching
          ? await searchBatchesApi(debouncedQuery.trim(), page)
          : await fetchAllBatches(String(page));

        const listRaw = isSearching
          ? res?.data || res?.batches || []
          : res?.batches || res?.data || [];
        const mapped: BatchItem[] = Array.isArray(listRaw) ? listRaw.map(mapBatch) : [];

        const curPage = Number(res?.currentPage || res?.page || page || 1);
        const totalPages = Number(res?.totalPages || 1);

        if (cancelled) return;
        setBatches((prev) => {
          const combined = page === 1 ? mapped : [...prev, ...mapped];
          if (isSearching) return combined;
          return [...combined].sort((a, b) => getSortRank(a.batchName) - getSortRank(b.batchName));
        });
        setHasMore(curPage < totalPages);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load batches');
          if (page === 1) setBatches([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, page]);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-background border rounded-lg p-6">
        <h1 className="text-2xl font-semibold mb-4">Batches</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
          className="divshadow flex flex-wrap items-center gap-3 sm:gap-5"
        >
          <div className="relative w-full">
            <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
              <Search strokeWidth={3} className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-grow block w-full p-4 ps-10 text-sm divshadow border rounded-md focus:outline-none outline-none bg-foreground/10"
              placeholder="Search Your Batch"
            />
            <button
              type="submit"
              className="absolute end-2.5 bottom-2.5 font-medium rounded-lg text-sm px-4 py-2 bg-green-400 dark:bg-green-500 text-white hover:bg-green-600 transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        <Carousel items={CAROUSEL_BANNERS} />

        {loading && page === 1 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <BatchCard key={idx} isPlaceholder />
            ))}
          </div>
        ) : batches.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {batches.map((b) => (
                <BatchCard
                  key={b._id || b.batchId}
                  id={b.batchId}
                  title={b.batchName}
                  image={b.batchImage}
                  type={b.language}
                  startDate={formatDateLabel(b.startDate)}
                  endDate={formatDateLabel(b.endDate)}
                  price={Number.isFinite(b.batchPrice) ? b.batchPrice.toFixed(0) : '0'}
                  forText={b.byName}
                />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-4">
                <button
                  type="button"
                  onClick={() => !loading && hasMore && setPage((p) => p + 1)}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-center mt-8 text-muted-foreground">No batches found.</p>
        )}
      </div>
    </div>
  );
}
