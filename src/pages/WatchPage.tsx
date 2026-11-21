import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { NoteCard, extractAttachmentsFromSchedule } from '../components/NoteCard';
import { VideoPlayerShell } from '../components/VideoPlayerShell';
import {
  apiFetch,
  fetchClearKeyOtp,
  fetchScheduleApi,
  fetchVideoUrlApi,
} from '../lib/api';
import { type LectureAttachment } from '../lib/constants';
import { useRouter, useSearchParams } from '../lib/router';
import { addStudyHistory } from '../lib/storage';

function extractYoutubeId(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.searchParams.get('v')) return u.searchParams.get('v') || '';
    const parts = u.pathname.split('/');
    const idx = parts.findIndex((p) => p === 'embed' || p === 'shorts');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return parts.filter(Boolean).pop() || '';
  } catch {
    return raw;
  }
}

export function WatchPage({ isLive = false }: { isLive?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const [playerMode, setPlayerMode] = useState<'dash' | 'hls' | 'mp4' | 'youtube' | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [signedQuery, setSignedQuery] = useState('');
  const [clearKeys, setClearKeys] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [attachments, setAttachments] = useState<LectureAttachment[]>([]);

  const batchId = searchParams.get('batchId') || '';
  const subjectId = searchParams.get('SubjectId') || '';
  const childId = searchParams.get('ContentId') || searchParams.get('ChildId') || '';
  const topicId = searchParams.get('topicId') || '';
  const fallbackVideoUrl = searchParams.get('VideoUrl') || '';
  const fallbackType = searchParams.get('Type') || '';

  useEffect(() => {
    if (!batchId || !subjectId || !childId) {
      setErrorMsg('Lecture URL parameters are incomplete.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrorMsg('');
      setPlayerMode(null);
      setStreamUrl('');
      setSignedQuery('');
      setClearKeys({});
      setAttachments([]);

      try {
        // 1. Fetch schedule details & attachments
        let schedule: any = null;
        try {
          const schedRes = await fetchScheduleApi(batchId, subjectId, childId);
          const raw = schedRes?.data?.data ?? schedRes?.data;
          schedule = Array.isArray(raw)
            ? raw.find((s: any) => String(s?._id || '') === childId) || raw[0]
            : raw;
        } catch {
          // continue with fallback URL if schedule unavailable
        }

        if (cancelled) return;

        const urlType = String(schedule?.urlType || fallbackType || 'penpencilvdo').toLowerCase();
        const rawUrl = String(schedule?.url || schedule?.videoDetails?.videoUrl || fallbackVideoUrl || '').trim();
        const lecTitle = String(schedule?.topic || schedule?.title || schedule?.videoDetails?.name || 'Lecture');
        setTitle(lecTitle);

        const extractedAtt = extractAttachmentsFromSchedule(schedule);
        setAttachments(extractedAtt);

        addStudyHistory({
          type: 'lecture',
          contentId: childId,
          title: lecTitle,
          batchId,
          subjectId,
          subject: String(schedule?.subject?.name || schedule?.subjectId?.name || ''),
          url: rawUrl,
          thumbnail: String(schedule?.image || schedule?.videoDetails?.image || ''),
          meta: {
            route: window.location.pathname + window.location.search,
            schedule,
          },
        });

        // 2. YouTube stream
        if (urlType === 'youtube') {
          if (!rawUrl) throw new Error('This lecture has no video link.');
          setPlayerMode('youtube');
          setStreamUrl(extractYoutubeId(rawUrl));
          setLoading(false);
          return;
        }

        // 3. Resolve playable stream URL via PW /api/get-video-url
        let baseUrl = '';
        let sig = '';

        try {
          const vidRes = await fetchVideoUrlApi(batchId, subjectId, childId, topicId);
          if (vidRes.ok && vidRes.data?.success && vidRes.data?.data?.url) {
            baseUrl = String(vidRes.data.data.url).trim();
            sig = String(vidRes.data.data.signedUrl || '').trim();

            if (baseUrl.includes('pimaxer.in') || baseUrl.includes('streama.pimaxer.in')) {
              const vidKey = String(vidRes.data.data.vid || childId);
              const keyCheckUrl = `/api/pw-proxy/streama.pimaxer.in/${vidKey}/hls-key?videoKey=${vidKey}&key=enc.key`;
              for (let attempt = 1; attempt <= 8; attempt++) {
                const kr = await apiFetch(keyCheckUrl).catch(() => null);
                if (kr && kr.status === 200) break;
                await new Promise((r) => setTimeout(r, 1200));
              }
            }
          }
        } catch {
          // fallback to rawUrl below
        }

        const resolvedUrl = baseUrl || rawUrl;
        if (!resolvedUrl) {
          if (extractedAtt.length > 0) {
            setPlayerMode(null);
            setLoading(false);
            return;
          }
          throw new Error('Unable to obtain a playable video stream URL. Please retry.');
        }

        const isM3u8 = /\.m3u8(\?|$)/i.test(resolvedUrl);
        const isMp4 = /\.mp4(\?|$)/i.test(resolvedUrl);

        if (isM3u8 || isLive) {
          setPlayerMode('hls');
          setStreamUrl(resolvedUrl);
          setSignedQuery(sig);
          setLoading(false);
          return;
        }

        if (isMp4) {
          setPlayerMode('mp4');
          setStreamUrl(resolvedUrl);
          setSignedQuery(sig);
          setLoading(false);
          return;
        }

        // 4. DASH MPD + ClearKey DRM check
        const fullMpdUrl = sig
          ? resolvedUrl.includes('?')
            ? `${resolvedUrl}&${sig.replace(/^[?&]/, '')}`
            : `${resolvedUrl}?${sig.replace(/^[?&]/, '')}`
          : resolvedUrl;

        const mpdResp = await apiFetch(`/api/play?url=${encodeURIComponent(fullMpdUrl)}`);
        if (mpdResp.ok) {
          const xmlText = await mpdResp.text();
          const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
          const cp = doc.querySelector('ContentProtection[schemeIdUri="urn:mpeg:dash:mp4protection:2011"]');
          const kidAttr = cp?.getAttribute('cenc:default_KID');
          if (kidAttr) {
            const cleanKid = kidAttr.replace(/-/g, '').toLowerCase();
            const keys = await fetchClearKeyOtp(cleanKid);
            if (!cancelled) setClearKeys(keys);
          }
        }

        if (!cancelled) {
          setPlayerMode('dash');
          setStreamUrl(resolvedUrl);
          setSignedQuery(sig);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Unable to load lecture stream.';
          setErrorMsg(msg);
          toast.error(msg);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [batchId, subjectId, childId, topicId, fallbackVideoUrl, fallbackType, isLive, retryCount]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-[4px] border-[#3f3f3f] border-r-[#777] border-t-[#dedede]" />
          <p className="text-xs text-white/75 animate-pulse">
            {isLive ? 'Loading live lecture...' : 'Preparing lecture...'}
          </p>
        </div>
      </div>
    );
  }

  if (playerMode === 'youtube' && streamUrl) {
    return <VideoPlayerShell mode="youtube" youtubeId={streamUrl} title={title} attachments={attachments} />;
  }

  if (playerMode && streamUrl) {
    return (
      <VideoPlayerShell
        mode={playerMode}
        src={streamUrl}
        signedQuery={signedQuery}
        clearKeys={clearKeys}
        title={title}
        attachments={attachments}
      />
    );
  }

  if (attachments.length > 0 && !errorMsg) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm font-medium text-[#7567ee] hover:underline"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold">{title || 'Attachments'}</h1>
          <div className="grid gap-3 sm:grid-cols-2">
            {attachments.map((att) => (
              <NoteCard key={att.id} note={att} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-black p-6 text-center text-white">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <p className="text-sm leading-6 text-white/85">
          {errorMsg || 'This lecture could not be loaded.'}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-10 rounded-full border border-white/25 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => setRetryCount((c) => c + 1)}
            className="h-10 rounded-full bg-white px-5 text-sm font-semibold text-black transition active:scale-95"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
