import React, { useEffect, useState } from 'react';
import { BookOpen, CalendarCheck2, Pin, PinOff, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { enrollBatchApi, unenrollBatchApi } from '../lib/api';
import { VIDEO_PLACEHOLDER } from '../lib/constants';
import { useRouter } from '../lib/router';
import { getEnrolledBatches, getSelectedBatch, saveEnrolledBatches, saveSelectedBatch } from '../lib/storage';

interface BatchCardProps {
  id?: string;
  title?: string;
  type?: string;
  image?: string;
  startDate?: string;
  endDate?: string;
  price?: string;
  forText?: string;
  isPlaceholder?: boolean;
}

export function BatchCard({
  id = '',
  title = '',
  type = '',
  image,
  startDate = '',
  endDate = '',
  price = '',
  forText = '',
  isPlaceholder = false,
}: BatchCardProps) {
  const router = useRouter();
  const [enrolled, setEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);

  const imgSrc = image || VIDEO_PLACEHOLDER;

  useEffect(() => {
    const sync = () => {
      setEnrolled(getEnrolledBatches().some((b) => b.batchId === id));
    };
    sync();
    window.addEventListener('batchesUpdated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('batchesUpdated', sync);
      window.removeEventListener('storage', sync);
    };
  }, [id]);

  if (isPlaceholder) {
    return (
      <article aria-hidden="true" className="overflow-hidden rounded-xl border bg-background p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="skeleton-shimmer h-5 w-3/5 rounded" />
          <div className="skeleton-shimmer h-6 w-12 rounded" />
        </div>
        <div className="skeleton-shimmer mt-4 aspect-video w-full rounded-lg" />
        <div className="mt-4 space-y-3">
          <div className="skeleton-shimmer h-4 w-2/5 rounded" />
          <div className="skeleton-shimmer h-4 w-4/5 rounded" />
          <div className="flex items-center justify-between gap-3">
            <div className="skeleton-shimmer h-5 w-20 rounded" />
            <div className="skeleton-shimmer h-5 w-28 rounded" />
          </div>
          <div className="flex gap-2 pt-1">
            <div className="skeleton-shimmer h-10 flex-1 rounded-md" />
            <div className="skeleton-shimmer h-10 flex-1 rounded-md" />
          </div>
        </div>
      </article>
    );
  }

  const handleEnroll = async () => {
    const list = getEnrolledBatches();
    if (list.some((b) => b.batchId === id)) {
      toast("You're already enrolled in this batch.");
      setEnrolled(true);
      return;
    }

    setBusy(true);
    const numPrice = Number(price);
    const nextList = [
      ...list,
      {
        batchId: id,
        name: title,
        batchName: title,
        batchImage: imgSrc,
        language: type,
        startDate,
        endDate,
        batchPrice: Number.isFinite(numPrice) ? numPrice : 0,
        byName: forText,
      },
    ];
    saveEnrolledBatches(nextList);
    setEnrolled(true);
    toast.success(`You've successfully enrolled in "${title}".`);

    try {
      await enrollBatchApi(id, title);
    } catch {
      // keep local enrollment persisted
    } finally {
      setBusy(false);
    }
  };

  const handleUnenroll = async () => {
    setBusy(true);
    const nextList = getEnrolledBatches().filter((b) => b.batchId !== id);
    saveEnrolledBatches(nextList);
    const selected = getSelectedBatch();
    if (selected?.batchId === id) {
      saveSelectedBatch(null);
    }
    setEnrolled(false);
    toast.success(`You have been unenrolled from "${title}".`);

    try {
      await unenrollBatchApi(id, title);
    } catch {
      // keep local removal persisted
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border rounded-xl overflow-hidden hover:shadow-lg dark:border-gray-700 transition-shadow bg-white dark:bg-gray-900 flex flex-wrap">
      <div className="p-4 pb-0 gap-1 space-y-3 relative flex items-center justify-between w-full">
        <h2 className="line-clamp-2 text-lg font-bold">{title}</h2>
        <div className="items-center !m-0 shrink-0">
          <span className="bg-yellow-400 text-black text-xs px-2 py-1 rounded font-medium">New</span>
        </div>
      </div>

      <div className="w-full p-4 flex flex-wrap justify-between">
        <div className="w-full rounded-lg overflow-hidden relative bg-muted/40 aspect-video">
          <img
            src={imgSrc}
            alt={title}
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.src = VIDEO_PLACEHOLDER;
            }}
          />
          <div className="absolute bottom-2 left-2 z-10">
            <span className="rounded-md bg-pink-500/70 dark:text-white dark:bg-green-500/80 px-2 py-1 text-xs font-medium text-white ring-1 ring-pink-700/10 ring-inset">
              {type || 'Hinglish'}
            </span>
          </div>
        </div>

        <div className="pt-3 space-y-3 w-full">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <UserCheck className="w-4 h-4 shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate">{forText || 'For Students'}</span>
          </div>

          <div className="flex items-center gap-1 text-muted-foreground text-xs flex-wrap">
            <CalendarCheck2 className="w-4 h-4 shrink-0" />
            <span>Starts on</span>
            <span className="text-xs font-semibold text-foreground">{startDate || '—'}</span>
            <span>| Ends on</span>
            <span className="text-xs font-semibold text-foreground">{endDate || '—'}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">
                ₹ FREE
              </span>
              {price && Number(price) > 0 && (
                <span className="text-xs text-muted-foreground line-through ml-2">₹{price}</span>
              )}
            </div>
            <span className="text-xs bg-green-50 dark:bg-green-500 text-green-600 dark:text-white px-2 py-1 rounded">
              100% Free For Students
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push(`/study/batches/${id}`)}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors flex-1 min-w-[120px]"
            >
              <BookOpen className="w-4 h-4" />
              <span>Study</span>
            </button>

            {enrolled ? (
              <button
                type="button"
                disabled={busy}
                onClick={handleUnenroll}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-4 py-2 rounded-md text-white text-xs sm:text-sm font-medium bg-red-600 hover:bg-red-700 transition-colors flex-1 min-w-[120px] disabled:opacity-60"
              >
                <PinOff className="w-4 h-4" />
                <span>Unenroll</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={handleEnroll}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-4 py-2 rounded-md text-xs sm:text-sm font-medium bg-green-400 text-white hover:bg-green-600 transition-colors flex-1 min-w-[120px] disabled:opacity-60"
              >
                <span>Enroll Now</span>
                <Pin className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
