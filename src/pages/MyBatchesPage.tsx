import React, { useEffect, useState } from 'react';
import { BatchCard } from '../components/BatchCard';
import { fetchAboutMeApi } from '../lib/api';
import { type EnrolledBatch } from '../lib/constants';
import { getEnrolledBatches, saveEnrolledBatches } from '../lib/storage';

function formatDateLabel(raw?: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return raw;
}

export function MyBatchesPage() {
  const [batches, setBatches] = useState<EnrolledBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncLocal = () => setBatches(getEnrolledBatches());
    syncLocal();

    fetchAboutMeApi()
      .then((me) => {
        const remote = Array.isArray(me?.enrolledBatches) ? me.enrolledBatches : [];
        if (remote.length > 0) {
          const map = new Map<string, EnrolledBatch>();
          [...remote, ...getEnrolledBatches()].forEach((b: any) => {
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
          const merged = Array.from(map.values());
          saveEnrolledBatches(merged);
          setBatches(merged);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    window.addEventListener('batchesUpdated', syncLocal);
    window.addEventListener('storage', syncLocal);
    return () => {
      window.removeEventListener('batchesUpdated', syncLocal);
      window.removeEventListener('storage', syncLocal);
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-background border rounded-lg p-6">
        <h1 className="text-2xl font-semibold mb-4">My Batches</h1>
        {loading && batches.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {Array.from({ length: 3 }).map((_, idx) => (
              <BatchCard key={idx} isPlaceholder />
            ))}
          </div>
        ) : batches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {batches.map((b) => (
              <BatchCard
                key={b.batchId}
                id={b.batchId}
                title={b.batchName || b.name}
                image={b.batchImage}
                type={b.language}
                startDate={formatDateLabel(b.startDate)}
                endDate={formatDateLabel(b.endDate)}
                price={String(b.batchPrice || 0)}
                forText={b.byName}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground mt-8">
            You are not enrolled in any batches yet.
          </div>
        )}
      </div>
    </div>
  );
}
