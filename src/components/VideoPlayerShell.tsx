import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import shaka from 'shaka-player/dist/shaka-player.compiled';
import { FolderOpen, Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';
import { AttachmentsDrawer } from './NoteCard';
import { type LectureAttachment } from '../lib/constants';
import { useRouter } from '../lib/router';

interface QualityOption {
  id: number | 'auto';
  label: string;
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function Seek10Icon({ dir }: { dir: 'back' | 'fwd' }) {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 sm:h-10 sm:w-10" fill="none" aria-hidden="true">
      {dir === 'back' ? (
        <>
          <path
            fill="#fff"
            d="M9.015 13.232a1.109 1.109 0 0 1 1.475-.125 1.001 1.001 0 0 1 .21 1.407 10.97 10.97 0 0 0-2.547 7.045c0 2.192.66 4.336 1.9 6.176a11.723 11.723 0 0 0 5.09 4.195c2.083.898 4.391 1.2 6.648.868a12.065 12.065 0 0 0 6.072-2.738 11.314 11.314 0 0 0 3.55-5.465c.609-2.112.569-4.348-.115-6.44a11.357 11.357 0 0 0-3.74-5.346 12.1 12.1 0 0 0-6.165-2.538l1.454 1.2a1.006 1.006 0 0 1 .118 1.457c-.186.208-.45.337-.735.358a1.106 1.106 0 0 1-.783-.245L17.68 9.94a1.04 1.04 0 0 1-.278-.354 1 1 0 0 1 .278-1.217l3.768-3.101a1.09 1.09 0 0 1 .784-.245c.14.01.278.048.404.11.126.06.239.145.33.249a.995.995 0 0 1 .142 1.14 1.04 1.04 0 0 1-.26.317l-1.622 1.337a14.335 14.335 0 0 1 7.422 2.818 13.46 13.46 0 0 1 4.611 6.253c.873 2.47.978 5.13.303 7.655a13.348 13.348 0 0 1-4.106 6.57 14.243 14.243 0 0 1-7.178 3.35c-2.68.423-5.432.09-7.919-.961a13.867 13.867 0 0 1-6.084-4.958A13.051 13.051 0 0 1 6 21.559c-.01-3.024 1.053-5.961 3.015-8.328Z"
          />
          <text x="14" y="26" fill="#fff" fontSize="11" fontWeight="700">
            10
          </text>
        </>
      ) : (
        <>
          <path
            fill="#fff"
            d="M30.99 13.236a1.11 1.11 0 0 0-1.496-.15 1.003 1.003 0 0 0-.195 1.43 10.965 10.965 0 0 1 2.548 7.045c.001 2.192-.659 4.337-1.899 6.177a11.726 11.726 0 0 1-5.091 4.196 12.303 12.303 0 0 1-6.65.868 12.071 12.071 0 0 1-6.076-2.737 11.313 11.313 0 0 1-3.55-5.465c-.61-2.112-.57-4.348.114-6.44a11.356 11.356 0 0 1 3.74-5.346 12.107 12.107 0 0 1 6.169-2.538l-1.459 1.2a1.008 1.008 0 0 0-.09 1.433 1.11 1.11 0 0 0 1.49.137l3.77-3.101a1.04 1.04 0 0 0 .278-.353 1 1 0 0 0-.277-1.217l-3.77-3.1a1.12 1.12 0 0 0-1.21-.165c-.13.062-.245.148-.339.254a.995.995 0 0 0-.128 1.165c.069.122.163.23.276.316l1.623 1.337a14.34 14.34 0 0 0-7.421 2.82 13.457 13.457 0 0 0-4.61 6.253 12.916 12.916 0 0 0-.299 7.653 13.345 13.345 0 0 0 4.107 6.567 14.248 14.248 0 0 0 7.18 3.346c2.68.424 5.432.09 7.919-.96 2.486-1.051 4.6-2.774 6.085-4.957a13.045 13.045 0 0 0 2.273-7.342c.012-3.023-1.05-5.96-3.012-8.326Z"
          />
          <text x="14" y="26" fill="#fff" fontSize="11" fontWeight="700">
            10
          </text>
        </>
      )}
    </svg>
  );
}

export function VideoPlayerShell({
  mode,
  src,
  signedQuery = '',
  clearKeys,
  youtubeId,
  title = '',
  attachments = [],
}: {
  mode: 'dash' | 'hls' | 'mp4' | 'youtube';
  src?: string;
  signedQuery?: string;
  clearKeys?: Record<string, string>;
  youtubeId?: string;
  title?: string;
  attachments?: LectureAttachment[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shakaRef = useRef<any>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const signedRef = useRef(signedQuery);
  signedRef.current = signedQuery;

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(mode !== 'youtube');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number | 'auto'>('auto');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsTab, setSettingsTab] = useState<'none' | 'main' | 'speed' | 'quality'>('none');
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [seekAnim, setSeekAnim] = useState<'back' | 'fwd' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const appendSigned = (url: string, q: string) => {
    if (!q) return url;
    const cleanQ = q.replace(/^[?&]/, '');
    if (!cleanQ || url.includes(cleanQ)) return url;
    return url.includes('?') ? `${url}&${cleanQ}` : `${url}?${cleanQ}`;
  };

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    if (mode === 'youtube' || !src || !videoRef.current) return;

    const video = videoRef.current;
    let cancelled = false;
    setErrorMsg('');
    setBuffering(true);
    setQualities([]);
    setSelectedQuality('auto');

    const cleanup = async () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (shakaRef.current) {
        try {
          await shakaRef.current.destroy();
        } catch {
          // ignore
        }
        shakaRef.current = null;
      }
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onPlaying = () => setBuffering(false);
    const onWaiting = () => setBuffering(true);
    const onTime = () => setCurrentTime(video.currentTime || 0);
    const onDur = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };
    const onRate = () => setPlaybackRate(video.playbackRate || 1);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onDur);
    video.addEventListener('durationchange', onDur);
    video.addEventListener('ratechange', onRate);

    const bufInterval = window.setInterval(() => {
      if (!video.buffered.length) return;
      const t = video.currentTime;
      for (let i = 0; i < video.buffered.length; i++) {
        if (t >= video.buffered.start(i) && t <= video.buffered.end(i)) {
          setBufferedEnd(video.buffered.end(i));
          break;
        }
      }
    }, 500);

    (async () => {
      await cleanup();
      if (cancelled) return;

      if (mode === 'dash') {
        try {
          shaka.polyfill.installAll();
          if (!shaka.Player.isBrowserSupported()) {
            throw new Error('This browser does not support protected DASH playback.');
          }
          const player = new shaka.Player();
          await player.attach(video);
          shakaRef.current = player;

          const net = player.getNetworkingEngine();
          net?.registerRequestFilter((_type: any, request: any) => {
            if (!request?.uris?.length) return;
            const u = request.uris[0];
            if (!u.includes('/api/') && !u.startsWith('data:') && !u.startsWith('blob:')) {
              request.uris[0] = appendSigned(u, signedRef.current);
            }
          });

          player.configure({
            abr: { enabled: true },
            ...(clearKeys && Object.keys(clearKeys).length > 0 ? { drm: { clearKeys } } : {}),
          });

          player.addEventListener('error', (ev: any) => {
            console.warn('Shaka error:', ev);
          });

          await player.load(appendSigned(src, signedRef.current));
          if (cancelled) return;

          const tracks: QualityOption[] = [];
          const seenH = new Set<number>();
          player.getVariantTracks().forEach((tr: any) => {
            if (tr?.height && !seenH.has(tr.height)) {
              seenH.add(tr.height);
              tracks.push({ id: tr.id, label: `${tr.height}p` });
            }
          });
          setQualities(tracks.sort((a, b) => parseInt(b.label, 10) - parseInt(a.label, 10)));
          setBuffering(false);
          video.play().catch(() => {});
        } catch (err) {
          if (!cancelled) {
            setBuffering(false);
            setErrorMsg(err instanceof Error ? err.message : 'Unable to play DASH stream.');
          }
        }
      } else if (mode === 'hls') {
        const finalUrl = appendSigned(src, signedRef.current);
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hlsRef.current = hls;
          hls.loadSource(finalUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
            if (cancelled) return;
            const levels: QualityOption[] = data.levels
              .map((lvl, idx) => ({ id: idx, label: lvl.height ? `${lvl.height}p` : `Level ${idx}` }))
              .reverse();
            setQualities(levels);
            setBuffering(false);
            video.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (data.fatal) {
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
              else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
              else setErrorMsg('Stream playback error. Please retry.');
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = finalUrl;
          setBuffering(false);
          video.play().catch(() => {});
        } else {
          setErrorMsg('HLS playback is not supported in this browser.');
          setBuffering(false);
        }
      } else {
        video.src = appendSigned(src, signedRef.current);
        setBuffering(false);
        video.play().catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(bufInterval);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onDur);
      video.removeEventListener('durationchange', onDur);
      video.removeEventListener('ratechange', onRate);
      cleanup();
    };
  }, [mode, src, clearKeys]);

  const scheduleHideControls = () => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (playing) {
      hideTimerRef.current = window.setTimeout(() => {
        if (settingsTab === 'none') setControlsVisible(false);
      }, 3200);
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const seekBy = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration || v.duration || 0, v.currentTime + delta));
    setSeekAnim(delta < 0 ? 'back' : 'fwd');
    window.setTimeout(() => setSeekAnim(null), 320);
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  const changeQuality = (opt: QualityOption | 'auto') => {
    if (opt === 'auto') {
      setSelectedQuality('auto');
      if (shakaRef.current) shakaRef.current.configure({ abr: { enabled: true } });
      if (hlsRef.current) hlsRef.current.currentLevel = -1;
    } else {
      setSelectedQuality(opt.id);
      if (shakaRef.current) {
        shakaRef.current.configure({ abr: { enabled: false } });
        const tr = shakaRef.current.getVariantTracks().find((t: any) => t.id === opt.id);
        if (tr) shakaRef.current.selectVariantTrack(tr, true);
      }
      if (hlsRef.current && typeof opt.id === 'number') {
        hlsRef.current.currentLevel = opt.id;
      }
    }
    setSettingsTab('none');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode === 'youtube') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        seekBy(-10);
      } else if (e.key === 'ArrowRight') {
        seekBy(10);
      } else if (e.key.toLowerCase() === 'm' && videoRef.current) {
        videoRef.current.muted = !videoRef.current.muted;
        setMuted(videoRef.current.muted);
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, duration]);

  const playedPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPct = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;

  if (mode === 'youtube' && youtubeId) {
    return (
      <div
        ref={containerRef}
        data-attachments-open={attachmentsOpen ? 'true' : 'false'}
        className="relative h-[100dvh] w-full bg-black overflow-hidden"
      >
        <iframe
          className="pw-player-shift h-full w-full border-0 transition-all duration-200"
          src={`https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&rel=0&modestbranding=1`}
          title={title || 'Lecture Player'}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />

        <div className="pointer-events-none absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
          <button
            type="button"
            onClick={() => router.back()}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 text-sm font-medium text-white hover:bg-black/80"
          >
            ← Back
          </button>

          {attachments.length > 0 && (
            <button
              type="button"
              onClick={() => setAttachmentsOpen((o) => !o)}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#7567ee] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#5a4bda]"
            >
              <FolderOpen className="h-4 w-4" />
              <span>Attachments ({attachments.length})</span>
            </button>
          )}
        </div>

        <AttachmentsDrawer
          open={attachmentsOpen}
          onClose={() => setAttachmentsOpen(false)}
          attachments={attachments}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-attachments-open={attachmentsOpen ? 'true' : 'false'}
      onMouseMove={scheduleHideControls}
      onClick={() => {
        if (settingsTab !== 'none') {
          setSettingsTab('none');
          return;
        }
        togglePlay();
        scheduleHideControls();
      }}
      className="relative h-[100dvh] w-full select-none bg-black overflow-hidden text-white"
    >
      <video
        ref={videoRef}
        playsInline
        className="pw-player-shift h-full w-full bg-black object-contain transition-all duration-200"
      />

      {buffering && !errorMsg && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/40">
          <div className="h-9 w-9 animate-spin rounded-full border-[4px] border-[#3f3f3f] border-r-[#777] border-t-[#dedede]" />
        </div>
      )}

      {errorMsg && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/85 p-6 text-center">
          <div className="max-w-sm space-y-4">
            <p className="text-sm text-white/85">{errorMsg}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.location.reload();
              }}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Top Overlay Bar */}
      <div
        className={`pw-player-shift absolute top-0 left-0 right-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/35 to-transparent p-3 sm:p-4 transition-opacity duration-200 ${
          controlsVisible || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {title && <p className="truncate text-sm sm:text-base font-medium text-white">{title}</p>}
        </div>

        <div className="flex items-center gap-2">
          {attachments.length > 0 && (
            <button
              type="button"
              onClick={() => setAttachmentsOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-[#7567ee] transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Attachments</span>
            </button>
          )}
        </div>
      </div>

      {/* Center Play / Seek Controls */}
      <div
        className={`pw-player-shift pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-10 sm:gap-16 transition-opacity duration-200 ${
          controlsVisible || !playing ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            seekBy(-10);
          }}
          aria-label="Rewind 10 seconds"
          className={`pointer-events-auto rounded-full p-2 hover:bg-white/15 transition ${
            seekAnim === 'back' ? 'animate-rotate-back' : ''
          }`}
        >
          <Seek10Icon dir="back" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          aria-label={playing ? 'Pause' : 'Play'}
          className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-black/50 hover:bg-black/75 transition"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-8 w-8">
              <path d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-9 w-9 ml-0.5">
              <path d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            seekBy(10);
          }}
          aria-label="Forward 10 seconds"
          className={`pointer-events-auto rounded-full p-2 hover:bg-white/15 transition ${
            seekAnim === 'fwd' ? 'animate-rotate-fwd' : ''
          }`}
        >
          <Seek10Icon dir="fwd" />
        </button>
      </div>

      {/* Bottom Scrubber & Toolbar */}
      <div
        className={`pw-player-shift absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-3 pt-8 sm:px-5 transition-opacity duration-200 ${
          controlsVisible || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.5}
          value={currentTime}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (videoRef.current) videoRef.current.currentTime = val;
            setCurrentTime(val);
          }}
          style={{
            ['--played' as any]: `${playedPct}%`,
            ['--buffered' as any]: `${bufferedPct}%`,
          }}
          className="pw-player-progress h-1 w-full cursor-pointer appearance-none rounded-full"
        />

        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-3">
            <span className="tabular-nums font-medium">
              {formatClock(currentTime)} / {formatClock(duration)}
            </span>

            <button
              type="button"
              onClick={() => {
                if (!videoRef.current) return;
                videoRef.current.muted = !videoRef.current.muted;
                setMuted(videoRef.current.muted);
              }}
              aria-label="Toggle Mute"
              className="p-1.5 hover:bg-white/15 rounded-full"
            >
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (videoRef.current) {
                  videoRef.current.volume = v;
                  videoRef.current.muted = v === 0;
                  setMuted(v === 0);
                }
              }}
              className="custom-slider hidden sm:block h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/30"
            />
          </div>

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsTab((prev) => (prev === 'none' ? 'main' : 'none'))}
              className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium hover:bg-white/20"
            >
              {playbackRate}x {selectedQuality !== 'auto' ? `• ${qualities.find((q) => q.id === selectedQuality)?.label || ''}` : ''}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Fullscreen"
              className="p-1.5 hover:bg-white/15 rounded-full"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>

            {/* Settings Popover */}
            {settingsTab !== 'none' && (
              <div className="absolute bottom-12 right-0 w-56 rounded-xl border border-white/15 bg-[#17171c]/95 p-2 text-xs text-white shadow-2xl backdrop-blur-md">
                {settingsTab === 'main' && (
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setSettingsTab('speed')}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 hover:bg-white/10"
                    >
                      <span>Playback Speed</span>
                      <span className="text-white/70">{playbackRate}x ›</span>
                    </button>
                    {qualities.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSettingsTab('quality')}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 hover:bg-white/10"
                      >
                        <span>Quality</span>
                        <span className="text-white/70">
                          {selectedQuality === 'auto'
                            ? 'Auto'
                            : qualities.find((q) => q.id === selectedQuality)?.label || 'Auto'}{' '}
                          ›
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {settingsTab === 'speed' && (
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setSettingsTab('main')}
                      className="mb-1 flex w-full items-center gap-2 border-b border-white/10 px-2 pb-1.5 font-semibold"
                    >
                      ‹ Playback Speed
                    </button>
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          if (videoRef.current) videoRef.current.playbackRate = rate;
                          setPlaybackRate(rate);
                          setSettingsTab('none');
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 hover:bg-white/10 ${
                          playbackRate === rate ? 'bg-white/15 font-semibold' : ''
                        }`}
                      >
                        <span>{rate === 1 ? 'Normal (1x)' : `${rate}x`}</span>
                        {playbackRate === rate && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                )}

                {settingsTab === 'quality' && (
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    <button
                      type="button"
                      onClick={() => setSettingsTab('main')}
                      className="mb-1 flex w-full items-center gap-2 border-b border-white/10 px-2 pb-1.5 font-semibold"
                    >
                      ‹ Quality
                    </button>
                    <button
                      type="button"
                      onClick={() => changeQuality('auto')}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 hover:bg-white/10 ${
                        selectedQuality === 'auto' ? 'bg-white/15 font-semibold' : ''
                      }`}
                    >
                      <span>Auto</span>
                      {selectedQuality === 'auto' && <span>✓</span>}
                    </button>
                    {qualities.map((q) => (
                      <button
                        key={String(q.id)}
                        type="button"
                        onClick={() => changeQuality(q)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 hover:bg-white/10 ${
                          selectedQuality === q.id ? 'bg-white/15 font-semibold' : ''
                        }`}
                      >
                        <span>{q.label}</span>
                        {selectedQuality === q.id && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AttachmentsDrawer
        open={attachmentsOpen}
        onClose={() => setAttachmentsOpen(false)}
        attachments={attachments}
      />
    </div>
  );
}
