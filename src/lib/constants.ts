export const BRAND_NAME = 'GB STUDY';
export const TELEGRAM_URL = 'https://t.me/GBFreestudy';
export const ICON_URL = 'https://i.ibb.co/Q3g9fGSt/1791541921524.png';

export const TEACHER_PLACEHOLDER = '/assets/img/teacher-placeholder.png';
export const VIDEO_PLACEHOLDER = '/assets/img/video-placeholder.svg';
export const DEFAULT_SUBJECT_ICON = '/assets/img/defaultSubject.svg';
export const DESCRIPTION_HEADER_BG = '/assets/img/descriptionHeader.svg';

export const STUDY_OFFERING_ICONS = {
  allClasses: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/d9884a89-e9f5-4d01-ad95-ff4435c66284.svg',
  myBatches: 'https://static.pw.live/5eb393ee95fab7468a79d189/ADMIN/d9884a89-e9f5-4d01-ad95-ff4435c66284.svg',
  notes: 'https://static.pw.live/study-mf/assets/svg/notes-android-1764087133.svg',
  dpp: 'https://static.pw.live/pw-omni/assets/svg/dpp-v2-chin-icon-1762937440.svg',
  playCircle: 'https://static.pw.live/study-mf/assets/svg/play-circle-1782192765.svg',
};

export interface ServerInfo {
  webName?: string;
  sidebarTitle?: string;
  sidebarLogoUrl?: string;
  tg_channel?: string;
  tg_bot?: string;
  maintenanceMode?: boolean;
  isDirectLoginOpen?: boolean;
  [key: string]: unknown;
}

export interface BatchItem {
  _id: string;
  batchId: string;
  batchName: string;
  name?: string;
  batchImage: string;
  language: string;
  template?: string;
  startDate: string;
  endDate: string;
  batchPrice: number;
  byName: string;
  slug?: string;
}

export interface EnrolledBatch {
  batchId: string;
  name: string;
  batchName?: string;
  batchImage?: string;
  language?: string;
  startDate?: string;
  endDate?: string;
  batchPrice?: number;
  byName?: string;
}

export interface SubjectItem {
  _id: string;
  subject: string;
  slug: string;
  tagCount?: number;
  batchSubjectId?: string;
  subjectId?: string | { _id?: string; slug?: string; name?: string };
  imageId?: { baseUrl?: string; key?: string };
}

export interface ChapterItem {
  _id: string;
  name: string;
  slug: string;
  videos?: number;
  exercises?: number;
  notes?: number;
}

export interface TeacherProfile {
  name: string;
  imageUrl: string;
}

export interface AttachmentFile {
  _id?: string;
  name?: string;
  baseUrl?: string;
  key?: string;
}

export interface HomeworkItem {
  _id?: string;
  topic?: string;
  name?: string;
  note?: string;
  attachmentIds?: AttachmentFile[];
}

export interface LectureAttachment {
  id: string;
  kind: 'note' | 'dpp-pdf' | 'dpp-quiz' | 'dpp-video';
  title: string;
  label: string;
  subject?: string;
  date?: string;
  url?: string;
  fileName?: string;
  batchId?: string;
  subjectId?: string;
  pdfId?: string;
  attachmentId?: string;
  totalQuestions?: number;
  totalMarks?: number;
  exerciseId?: string;
  duration?: string;
  thumbnail?: string;
}

export interface HistoryEntry {
  _id?: string;
  type: 'lecture' | 'note' | 'dpp-pdf' | 'dpp-quiz' | 'dpp-video';
  contentId: string;
  title: string;
  batchId?: string;
  subjectId?: string;
  subject?: string;
  url?: string;
  thumbnail?: string;
  watchedAt: string;
  meta?: Record<string, unknown>;
}
