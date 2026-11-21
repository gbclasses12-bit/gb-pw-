import { BRAND_NAME, ICON_URL, TELEGRAM_URL, type ServerInfo } from './constants';

const RETRY_STATUSES = new Set([503]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SESSION_STORAGE_KEY = 'GB_STUDY_SESSION';
let memorySessionToken = '';
let isRedirectingToAuth = false;

export function getSessionToken(): string {
  if (memorySessionToken) return memorySessionToken;
  try {
    const stored =
      localStorage.getItem(SESSION_STORAGE_KEY) || sessionStorage.getItem(SESSION_STORAGE_KEY) || '';
    if (stored) memorySessionToken = stored;
    return stored;
  } catch {
    return memorySessionToken;
  }
}

export function setSessionToken(token: string): void {
  if (!token) return;
  memorySessionToken = token;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, token);
  } catch {
    // ignore storage restriction
  }
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, token);
  } catch {
    // ignore storage restriction
  }
}

export function clearSessionToken(): void {
  memorySessionToken = '';
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const isSafeMethod = method === 'GET' || method === 'HEAD';
  let attempt = 0;
  for (;;) {
    const target = input instanceof Request ? input.clone() : input;
    const headers = new Headers(init.headers);
    const sessionToken = getSessionToken();
    if (sessionToken && !headers.has('X-GB-Session')) {
      headers.set('X-GB-Session', sessionToken);
    }
    const res = await fetch(target, { ...init, headers, credentials: 'include' });
    const nextSession = res.headers.get('X-GB-Session');
    if (nextSession) {
      setSessionToken(nextSession);
    }
    if (!isSafeMethod || !RETRY_STATUSES.has(res.status) || attempt >= 2) {
      return res;
    }
    attempt += 1;
    await wait(400 * attempt);
  }
}

export function redirectToAuthIfUnauthorized(res: Response): boolean {
  if (res.status === 401) {
    clearSessionToken();
    const current = window.location.pathname + window.location.search;
    if (!window.location.pathname.startsWith('/auth') && !isRedirectingToAuth) {
      isRedirectingToAuth = true;
      const redirectParam = encodeURIComponent(current || '/study');
      const authTarget = `/auth?redirect=${redirectParam}`;
      window.dispatchEvent(new CustomEvent('gb:auth-required', { detail: authTarget }));
      window.setTimeout(() => {
        isRedirectingToAuth = false;
      }, 1500);
    }
    return true;
  }
  return false;
}

export async function fetchServerInfo(): Promise<ServerInfo> {
  try {
    const res = await apiFetch('/api/auth/serverInfo', { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed');
    const data = (await res.json()) as ServerInfo & { _session?: string };
    if (typeof data?._session === 'string' && data._session) {
      setSessionToken(data._session);
    }
    return {
      ...data,
      webName: BRAND_NAME,
      sidebarTitle: BRAND_NAME,
      tg_channel: TELEGRAM_URL,
      sidebarLogoUrl: ICON_URL,
    };
  } catch {
    return {
      webName: BRAND_NAME,
      sidebarTitle: BRAND_NAME,
      tg_channel: TELEGRAM_URL,
      sidebarLogoUrl: ICON_URL,
    };
  }
}

export async function sendOtpApi(phoneNumber: string, smsType: '0' | '1' = '0') {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ phoneNumber, smsType, fallback: 'false' }),
  });
  const data = await res.json().catch(() => null);
  if (typeof data?._session === 'string' && data._session) {
    setSessionToken(data._session);
  }
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || data?.error || 'Unable to send OTP. Please try again.');
  }
  return data;
}

export async function resendOtpApi(phoneNumber: string, smsType: '0' | '1' = '0') {
  const res = await apiFetch('/api/auth/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ phoneNumber, smsType, fallback: 'false' }),
  });
  const data = await res.json().catch(() => null);
  if (typeof data?._session === 'string' && data._session) {
    setSessionToken(data._session);
  }
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || data?.error || 'Unable to resend OTP. Please try again.');
  }
  return data;
}

export async function verifyOtpApi(phoneNumber: string, otp: string) {
  const res = await apiFetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ phoneNumber, otp }),
  });
  const data = await res.json().catch(() => null);
  if (typeof data?._session === 'string' && data._session) {
    setSessionToken(data._session);
  }
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || data?.error || 'OTP verification failed. Please try again.');
  }
  if (data?._hasAuthCookie === false) {
    throw new Error('Login session token receive nahi hua. Kripya dobara OTP mangwayein.');
  }
  isRedirectingToAuth = false;
  return data;
}

export async function fetchAllBatches(page = '1') {
  const res = await apiFetch(`/api/AllBatches?page=${encodeURIComponent(page)}`, { cache: 'no-store' });
  if (redirectToAuthIfUnauthorized(res)) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to fetch batches');
  return res.json();
}

export async function searchBatchesApi(name: string, page = 1) {
  const res = await apiFetch(`/api/searchBatch?name=${encodeURIComponent(name)}&page=${page}`, {
    cache: 'no-store',
  });
  if (redirectToAuthIfUnauthorized(res)) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to search batches');
  return res.json();
}

export async function fetchAboutMeApi(redirectOn401 = true) {
  const res = await apiFetch('/api/AboutMe', { cache: 'no-store' });
  if (res.status === 401) {
    if (redirectOn401) redirectToAuthIfUnauthorized(res);
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

export async function enrollBatchApi(batchId: string, name: string) {
  const res = await apiFetch('/api/enrollBatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId, name }),
  });
  if (redirectToAuthIfUnauthorized(res)) throw new Error('Unauthorized');
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || 'Failed to enroll in batch');
  return data;
}

export async function unenrollBatchApi(batchId: string, name: string) {
  const res = await apiFetch('/api/UnenrollBatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId, name }),
  });
  if (redirectToAuthIfUnauthorized(res)) throw new Error('Unauthorized');
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || 'Failed to unenroll from batch');
  return data;
}

export async function fetchBatchInfo(batchId: string, type: 'details' | 'announcement', page = 1) {
  let url = `/api/BatchInfo?BatchId=${encodeURIComponent(batchId)}&Type=${type}`;
  if (type === 'announcement') url += `&page=${page}`;
  const res = await apiFetch(url);
  if (redirectToAuthIfUnauthorized(res)) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to fetch batch details');
  return res.json();
}

export async function fetchSubjectInfo(batchId: string, subjectId: string, page = 1) {
  const url = `/api/SubjectInfo?BatchId=${encodeURIComponent(batchId)}&SubjectId=${encodeURIComponent(subjectId)}&page=${page}`;
  const res = await apiFetch(url);
  if (redirectToAuthIfUnauthorized(res)) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to fetch subject chapters');
  return res.json();
}

export async function fetchTopicInfo(
  batchId: string,
  subjectId: string,
  topicId: string,
  contentType: string,
  page = 1,
) {
  const url = `/api/TopicInfo?BatchId=${encodeURIComponent(batchId)}&SubjectId=${encodeURIComponent(
    subjectId,
  )}&TopicId=${encodeURIComponent(topicId)}&ContentType=${encodeURIComponent(contentType)}&page=${page}`;
  const res = await apiFetch(url);
  if (redirectToAuthIfUnauthorized(res)) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to fetch topic content');
  return res.json();
}

export async function fetchPdfApi(
  batchId: string,
  subjectId: string,
  pdfId: string,
  attachmentId?: string,
) {
  const params = new URLSearchParams({
    BatchId: batchId,
    SubjectId: subjectId,
    PdfId: pdfId,
  });
  if (attachmentId) params.set('AttachmentId', attachmentId);
  const res = await apiFetch(`/api/GetPdf?${params.toString()}`);
  if (redirectToAuthIfUnauthorized(res)) throw new Error('Unauthorized');
  if (!res.ok) throw new Error('Failed to load PDF');
  return res.json();
}

export async function fetchTodaysSchedule(batchId: string, redirectOn401 = false) {
  const res = await apiFetch('/api/todays-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId }),
    cache: 'no-store',
  });
  if (res.status === 401) {
    if (redirectOn401) redirectToAuthIfUnauthorized(res);
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error("Failed to load today's classes");
  return res.json();
}

export async function fetchUserDetailsList(ids: string[]) {
  if (!ids.length) return { data: [] };
  const res = await apiFetch('/api/get-user-details-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idsParam: ids.join(',') }),
  });
  if (!res.ok) return { data: [] };
  return res.json();
}

export async function fetchScheduleApi(batchId: string, subjectId: string, contentId: string) {
  const params = new URLSearchParams({
    BatchId: batchId,
    SubjectId: subjectId,
    ContentId: contentId,
  });
  const res = await apiFetch(`/api/Schedule?${params.toString()}`, { cache: 'no-store' });
  if (redirectToAuthIfUnauthorized(res)) throw new Error('Unauthorized');
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || 'Failed to fetch schedule');
  return data;
}

export async function fetchVideoUrlApi(
  batchId: string,
  subjectId: string,
  childId: string,
  topicId = '',
) {
  const params = new URLSearchParams({
    batchId,
    subjectId,
    childId,
    topicId,
  });
  const res = await apiFetch(`/api/get-video-url?${params.toString()}`, { cache: 'no-store' });
  if (redirectToAuthIfUnauthorized(res)) throw new Error('Unauthorized');
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

export async function fetchClearKeyOtp(kid: string) {
  const res = await apiFetch(`/api/get-otp?kid=${encodeURIComponent(kid)}`, { cache: 'no-store' });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.clearKeys) {
    throw new Error(data?.message || 'Missing clearKeys in OTP response');
  }
  return data.clearKeys as Record<string, string>;
}
