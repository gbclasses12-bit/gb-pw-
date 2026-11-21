import React, { useMemo, useState } from 'react';
import {
  ChevronUp,
  Clock,
  Download,
  Eye,
  FileText,
  ListChecks,
  Play,
  PlayCircle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchPdfApi } from '../lib/api';
import { STUDY_OFFERING_ICONS, type LectureAttachment } from '../lib/constants';
import { addStudyHistory } from '../lib/storage';

const asArray = <T,>(val: T | T[] | null | undefined): T[] =>
  Array.isArray(val) ? val : val ? [val] : [];

const cleanUrl = (raw?: string): string => {
  const s = String(raw || '').trim();
  const match = s.match(/^\[(https?:\/\/[^\]]+)\]\(https?:\/\/[^)]+\)$/i);
  return match?.[1] || s;
};

export function extractAttachmentsFromSchedule(schedule: Record<string, any> | null): LectureAttachment[] {
  if (!schedule) return [];

  const batchId = String(schedule.batchId || '');
  const subjectObj = schedule.subject || schedule.subjectId;
  const subjectId = String(
    (typeof subjectObj === 'object' ? subjectObj?.slug || subjectObj?._id : subjectObj) || '',
  );
  const subjectName = String(
    (typeof subjectObj === 'object' ? subjectObj?.name : '') || '',
  );

  const notes: LectureAttachment[] = asArray(schedule.homeworkIds).flatMap((hw: any) =>
    asArray(hw?.attachmentIds).map((att: any) => {
      const base = cleanUrl(att?.baseUrl);
      const key = String(att?.key || '');
      return {
        id: `note-${att?._id || key || hw?._id || Math.random()}`,
        kind: 'note' as const,
        title: String(hw?.topic || att?.name || 'Class Notes'),
        label: String(hw?.note || 'Class Notes'),
        subject: subjectName,
        url: base && key ? `${base}${key}` : '',
        fileName: String(att?.name || `${hw?.topic || 'Class Notes'}.pdf`),
        batchId,
        subjectId,
        pdfId: String(schedule._id || ''),
        attachmentId: String(att?._id || ''),
      };
    }),
  );

  const quizzes: LectureAttachment[] = asArray(schedule.exerciseIds).flatMap((ex: any) => {
    const first = asArray(ex?.content)[0]?.exerciseId || {};
    const exerciseId = String(first?._id || ex?._id || '');
    if (!exerciseId) return [];
    return [
      {
        id: `quiz-${exerciseId}`,
        kind: 'dpp-quiz' as const,
        title: String(ex?.title || first?.name || 'DPP Quiz'),
        label: 'DPP',
        subject: subjectName,
        totalQuestions: Number(first?.totalQuestions || 0) || undefined,
        totalMarks: Number(first?.totalMarks || 0) || undefined,
        exerciseId,
      },
    ];
  });

  const dppPdfs: LectureAttachment[] = asArray(schedule.dpp?.homeworkIds).flatMap((hw: any) =>
    asArray(hw?.attachmentIds).map((att: any) => {
      const base = cleanUrl(att?.baseUrl);
      const key = String(att?.key || '');
      return {
        id: `dpp-pdf-${att?._id || key || hw?._id || Math.random()}`,
        kind: 'dpp-pdf' as const,
        title: String(hw?.topic || att?.name || 'DPP PDF'),
        label: String(hw?.note || 'DPP'),
        subject: subjectName,
        url: base && key ? `${base}${key}` : '',
        fileName: String(att?.name || `${hw?.topic || 'DPP'}.pdf`),
        batchId,
        subjectId,
        pdfId: String(schedule.dpp?._id || schedule._id || ''),
        attachmentId: String(att?._id || ''),
      };
    }),
  );

  const dppVid = schedule.dpp?.videoDetails;
  const dppVidUrl = cleanUrl(dppVid?.videoUrl || schedule.dpp?.url || schedule.dpp?.publicUrl);
  const dppVideos: LectureAttachment[] = dppVidUrl
    ? [
        {
          id: `dpp-video-${dppVid?._id || schedule.dpp?._id || 'video'}`,
          kind: 'dpp-video',
          title: String(dppVid?.name || schedule.dpp?.topic || 'DPP Solution'),
          label: 'DPP Video',
          subject: subjectName,
          url: dppVidUrl,
          duration: String(dppVid?.duration || ''),
          thumbnail: cleanUrl(dppVid?.image),
        },
      ]
    : [];

  return [...notes, ...quizzes, ...dppPdfs, ...dppVideos];
}

export async function resolveAttachmentPdfUrl(note: LectureAttachment): Promise<string> {
  if (note.batchId && note.subjectId && note.pdfId) {
    try {
      const res = await fetchPdfApi(note.batchId, note.subjectId, note.pdfId, note.attachmentId);
      const payload = res?.data?.data ?? res?.data;
      if (payload?.baseUrl && payload?.key) {
        return `${cleanUrl(payload.baseUrl)}${payload.key}`;
      }
    } catch (err) {
      if (!note.url) throw err;
    }
  }
  if (note.url) return note.url;
  throw new Error('Attachment is not available');
}

export function NoteCard({
  note,
  horizontal = false,
  onAttachments,
}: {
  note: LectureAttachment;
  horizontal?: boolean;
  onAttachments?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleView = async () => {
    setLoading(true);
    try {
      const url = await resolveAttachmentPdfUrl(note);
      addStudyHistory({
        type: /dpp|test paper|practice test/i.test(`${note.label} ${note.title}`) ? 'dpp-pdf' : 'note',
        contentId: note.id || note.pdfId || note.attachmentId || url,
        title: note.title,
        batchId: note.batchId,
        subjectId: note.subjectId,
        subject: note.subject,
        url,
        meta: { ...note, resolvedUrl: url, openedAt: new Date().toISOString() },
      });
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to open note');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const url = await resolveAttachmentPdfUrl(note);
      const a = document.createElement('a');
      a.href = url;
      a.download = note.fileName || `${note.title}.pdf`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to download note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <article
      className={`min-w-0 max-w-full overflow-hidden rounded-2xl border bg-background p-3 shadow-sm transition hover:shadow-md ${
        horizontal ? 'w-[290px] min-w-[290px] shrink-0' : 'w-full'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={STUDY_OFFERING_ICONS.notes}
          alt="Notes"
          className="h-16 w-16 shrink-0 rounded-xl bg-sky-100 object-contain sm:h-[72px] sm:w-[72px]"
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="mb-1 flex min-w-0 items-center gap-1.5 overflow-hidden text-xs uppercase text-muted-foreground">
            <span className="min-w-0 truncate">{note.label}</span>
            {note.date && <span className="shrink-0">• {note.date}</span>}
          </div>
          <h3 className="line-clamp-2 break-words text-sm font-semibold" title={note.title}>
            {note.title}
          </h3>
          {note.subject && (
            <p className="mt-1 max-w-full truncate text-xs text-muted-foreground">{note.subject}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex min-w-0 gap-2">
        <button
          type="button"
          onClick={handleView}
          disabled={loading}
          className="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden rounded-md bg-muted px-3 text-sm font-medium transition hover:bg-[#7567ee] hover:text-white sm:px-4"
        >
          <Eye className="h-5 w-5 shrink-0" />
          <span className="truncate">{loading ? 'Loading...' : 'View Note'}</span>
        </button>

        {onAttachments && (
          <button
            type="button"
            onClick={onAttachments}
            className="flex h-9 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-muted px-3 text-sm font-medium transition hover:bg-muted/70"
          >
            <span className="truncate">Attachments</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleDownload}
          disabled={loading}
          aria-label={`Download ${note.title}`}
          className="flex h-9 w-11 shrink-0 items-center justify-center rounded-md bg-muted transition hover:bg-[#7567ee] hover:text-white sm:w-12"
        >
          <Download className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}

export function NoteCardSkeleton({ horizontal = false }: { horizontal?: boolean }) {
  return (
    <article
      aria-hidden="true"
      className={`min-w-0 max-w-full overflow-hidden rounded-2xl border bg-background p-3 ${
        horizontal ? 'w-[290px] min-w-[290px] shrink-0' : 'w-full'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="skeleton-shimmer h-16 w-16 shrink-0 rounded-xl sm:h-[72px] sm:w-[72px]" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="skeleton-shimmer h-3 w-24 max-w-full rounded" />
          <div className="skeleton-shimmer h-4 w-full rounded" />
          <div className="skeleton-shimmer h-3 w-2/3 rounded" />
        </div>
      </div>
      <div className="mt-3 flex min-w-0 gap-2">
        <div className="skeleton-shimmer h-9 min-w-0 flex-1 rounded-md" />
        <div className="skeleton-shimmer h-9 w-11 shrink-0 rounded-md sm:w-12" />
      </div>
    </article>
  );
}

function DrawerAttachmentRow({ note }: { note: LectureAttachment }) {
  const [busy, setBusy] = useState(false);

  const openFile = async () => {
    setBusy(true);
    try {
      const url = await resolveAttachmentPdfUrl(note);
      addStudyHistory({
        type: note.kind === 'dpp-pdf' ? 'dpp-pdf' : 'note',
        contentId: note.id || note.pdfId || note.attachmentId || url,
        title: note.title,
        batchId: note.batchId,
        subjectId: note.subjectId,
        subject: note.subject,
        url,
        meta: { ...note, resolvedUrl: url },
      });
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to open attachment');
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = async () => {
    setBusy(true);
    try {
      const url = await resolveAttachmentPdfUrl(note);
      const a = document.createElement('a');
      a.href = url;
      a.download = note.fileName || `${note.title}.pdf`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to download attachment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="flex min-h-[58px] items-center gap-3 rounded-lg border border-[#e7e7e7] bg-white px-3 py-2.5">
      <FileText className="h-[18px] w-[18px] shrink-0 text-[#4b4b4b]" strokeWidth={1.5} />
      <button type="button" onClick={openFile} disabled={busy} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[12px] font-medium text-[#242424] sm:text-[13px]">{note.title}</p>
      </button>
      <button
        type="button"
        onClick={downloadFile}
        disabled={busy}
        aria-label={`Download ${note.title}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#555] transition hover:bg-black/5 disabled:opacity-50"
      >
        {busy ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black/70" />
        ) : (
          <Download className="h-[18px] w-[18px]" strokeWidth={1.6} />
        )}
      </button>
    </article>
  );
}

export function AttachmentsDrawer({
  open,
  onClose,
  attachments,
}: {
  open: boolean;
  onClose: () => void;
  attachments: LectureAttachment[];
}) {
  const grouped = useMemo(
    () => ({
      notes: attachments.filter((a) => a.kind === 'note'),
      dpp: attachments.filter((a) => a.kind === 'dpp-quiz'),
      dppPdf: attachments.filter((a) => a.kind === 'dpp-pdf'),
      dppVideos: attachments.filter((a) => a.kind === 'dpp-video'),
    }),
    [attachments],
  );

  if (!open) return null;

  const sections: { title: string; items: LectureAttachment[] }[] = [
    { title: 'Notes', items: grouped.notes },
    { title: 'DPP', items: grouped.dpp },
    { title: 'DPP PDF', items: grouped.dppPdf },
    { title: 'DPP Videos', items: grouped.dppVideos },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 z-50 bg-transparent">
      <aside
        onPointerDown={(e) => e.stopPropagation()}
        className="pw-attachments-drawer pointer-events-auto absolute bottom-0 left-0 right-0 top-[56.25vw] flex min-h-0 flex-col overflow-hidden bg-white text-[#171717] shadow-2xl lg:bottom-0 lg:left-auto lg:top-0 lg:h-full lg:w-[350px] lg:border-l lg:border-[#dedede]"
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#dedede] px-4 lg:h-10">
          <h2 className="text-[14px] font-semibold sm:text-[15px]">Attachments</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close attachments"
            className="grid h-9 w-9 place-items-center rounded-full transition hover:bg-black/5"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {attachments.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#666]">
              No attachments are available for this lecture.
            </div>
          ) : (
            sections.map((sec) =>
              sec.items.length === 0 ? null : (
                <section key={sec.title} className="py-3">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="text-[13px] font-semibold text-[#202020] sm:text-[14px]">
                      {sec.title}
                    </h3>
                    <ChevronUp className="h-4 w-4 text-[#333]" strokeWidth={1.8} />
                  </div>
                  <div className="space-y-2">
                    {sec.items.map((item) =>
                      item.kind === 'dpp-quiz' ? (
                        <article
                          key={item.id}
                          className="flex min-h-[62px] items-center gap-3 rounded-lg border border-[#e7e7e7] bg-white px-3 py-2.5"
                        >
                          <ListChecks className="h-5 w-5 shrink-0 text-[#4b4b4b]" strokeWidth={1.5} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-medium text-[#242424] sm:text-[13px]">
                              {item.title}
                            </p>
                            <p className="mt-1 text-[10px] text-[#555] sm:text-[11px]">
                              {item.totalQuestions || 0} Questions &nbsp;|&nbsp; {item.totalMarks || 0}{' '}
                              Marks
                            </p>
                          </div>
                          <PlayCircle className="h-6 w-6 text-[#7567ee]" />
                        </article>
                      ) : item.kind === 'dpp-video' ? (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.url) {
                              const a = document.createElement('a');
                              a.href = item.url;
                              a.target = '_blank';
                              a.rel = 'noopener noreferrer';
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                            }
                          }}
                          className="flex min-h-[74px] w-full items-center gap-3 rounded-lg border border-[#e7e7e7] bg-white px-2.5 py-2 text-left"
                        >
                          <div className="relative h-[56px] w-[102px] shrink-0 overflow-hidden rounded-md bg-[#f3f0ff]">
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full w-full place-items-center">
                                <Play className="h-5 w-5 text-[#7567ee]" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[12px] font-medium text-[#242424] sm:text-[13px]">
                              {item.title}
                            </p>
                            {item.duration && (
                              <p className="mt-2 flex items-center gap-1 text-[10px] text-[#777] sm:text-[11px]">
                                <Clock className="h-3 w-3" /> {item.duration}
                              </p>
                            )}
                          </div>
                        </button>
                      ) : (
                        <DrawerAttachmentRow key={item.id} note={item} />
                      ),
                    )}
                  </div>
                </section>
              ),
            )
          )}
        </div>
      </aside>
    </div>
  );
}
