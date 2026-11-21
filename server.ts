import express, { type Request, type Response } from 'express';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const UPSTREAM_ORIGIN = process.env.PW_UPSTREAM_ORIGIN || 'https://physicswallah.studybeepro.in';
const UPSTREAM_HOST = new URL(UPSTREAM_ORIGIN).host;
const ASSET_FALLBACK_ORIGIN = 'https://gbstudynexttopper.vercel.app';
const PROXY_DEBUG_LOG = '/tmp/pw_proxy_debug.log';

export const BRAND_NAME = 'GB STUDY';
export const TELEGRAM_URL = 'https://t.me/GBFreestudy';
export const ICON_URL = 'https://i.ibb.co/Q3g9fGSt/1791541921524.png';

const OLD_ICON_URL = 'https://i.ibb.co/4wPxf3SS/studypanda-square-hd.webp';
const OLD_TELEGRAM_URL = 'https://t.me/+BuACcjHkg2BjZGFl';
const OLD_TELEGRAM_URL_ALT = 'https://telegram.me/+BuACcjHkg2BjZGFl';

const PORT = Number(process.env.PORT) || 3000;

const assetCache = new Map<string, { contentType: string; body: Buffer }>();
let cachedIconBuffer: { contentType: string; body: Buffer } | null = null;

const VIDEO_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="640" y2="360" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#312e81"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <circle cx="320" cy="180" r="44" fill="#7567ee" fill-opacity="0.9"/>
  <path d="M308 158L344 180L308 202V158Z" fill="white"/>
</svg>`;

function rewriteBrandText(input: string): string {
  return input
    .replaceAll(OLD_ICON_URL, ICON_URL)
    .replaceAll(OLD_ICON_URL.replaceAll('/', '\\/'), ICON_URL.replaceAll('/', '\\/'))
    .replaceAll(OLD_TELEGRAM_URL, TELEGRAM_URL)
    .replaceAll(OLD_TELEGRAM_URL.replaceAll('/', '\\/'), TELEGRAM_URL.replaceAll('/', '\\/'))
    .replaceAll(OLD_TELEGRAM_URL_ALT, TELEGRAM_URL)
    .replaceAll(OLD_TELEGRAM_URL_ALT.replaceAll('/', '\\/'), TELEGRAM_URL.replaceAll('/', '\\/'))
    .replaceAll('Study Panda', BRAND_NAME)
    .replaceAll('Study Bee', BRAND_NAME);
}

function getSessionSecretKey(): Buffer {
  if (process.env.SESSION_SECRET) {
    return crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest();
  }
  const keyFile = '/tmp/.gb_study_session_key';
  try {
    if (fs.existsSync(keyFile)) {
      const hex = fs.readFileSync(keyFile, 'utf8').trim();
      if (/^[0-9a-f]{64}$/i.test(hex)) {
        return Buffer.from(hex, 'hex');
      }
    }
    const generated = crypto.randomBytes(32);
    fs.writeFileSync(keyFile, generated.toString('hex'), { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32);
  }
}

const SESSION_KEY = getSessionSecretKey();

function decryptCookieJar(token?: string): Map<string, string> {
  const jar = new Map<string, string>();
  if (!token || !token.startsWith('v1.')) return jar;
  const parts = token.split('.');
  if (parts.length !== 4) return jar;
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const cipherText = Buffer.from(parts[3], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', SESSION_KEY, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(plain) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v.length > 0) {
          jar.set(k, v);
        }
      }
    }
  } catch {
    // ignore tampered/stale token
  }
  return jar;
}

function encryptCookieJar(jar: Map<string, string>): string {
  if (jar.size === 0) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SESSION_KEY, iv);
  const payload = JSON.stringify(Object.fromEntries(jar.entries()));
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function mergeCookieHeader(jar: Map<string, string>, rawCookieHeader?: string): void {
  if (!rawCookieHeader) return;
  for (const part of rawCookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (name && val) {
      jar.set(name, val);
    }
  }
}

function isCookieDeletion(rawSetCookie: string): boolean {
  const semi = rawSetCookie.indexOf(';');
  const nv = (semi === -1 ? rawSetCookie : rawSetCookie.slice(0, semi)).trim();
  const eq = nv.indexOf('=');
  if (eq <= 0) return false;
  const val = nv.slice(eq + 1).trim();
  return (
    val === '' ||
    /;\s*Max-Age\s*=\s*0\b/i.test(rawSetCookie) ||
    /;\s*Expires\s*=\s*Thu,\s*01\s+Jan\s+1970/i.test(rawSetCookie)
  );
}

function applySetCookies(
  jar: Map<string, string>,
  setCookies: string[],
  allowDelete = false,
): void {
  for (const raw of setCookies) {
    const semi = raw.indexOf(';');
    const nv = (semi === -1 ? raw : raw.slice(0, semi)).trim();
    const eq = nv.indexOf('=');
    if (eq <= 0) continue;
    const name = nv.slice(0, eq).trim();
    const val = nv.slice(eq + 1).trim();
    const isDeleted = isCookieDeletion(raw);
    if (isDeleted) {
      if (allowDelete) {
        jar.delete(name);
      }
    } else {
      jar.set(name, val);
    }
  }
}

function appendProxyDebugLog(line: string): void {
  try {
    fs.appendFileSync(PROXY_DEBUG_LOG, `${new Date().toISOString()} ${line}\n`, { mode: 0o600 });
  } catch {
    // ignore log failures
  }
}

function rewriteSetCookie(cookie: string, isHttps: boolean): string {
  let updated = cookie.replace(/;\s*Domain=[^;]+/gi, '');
  if (isHttps) {
    if (/;\s*SameSite=/i.test(updated)) {
      updated = updated.replace(/;\s*SameSite=(Lax|Strict|None)/gi, '; SameSite=None');
    } else {
      updated += '; SameSite=None';
    }
    if (!/;\s*Secure\b/i.test(updated)) {
      updated += '; Secure';
    }
    if (!/;\s*Partitioned\b/i.test(updated)) {
      updated += '; Partitioned';
    }
  } else {
    updated = updated.replace(/;\s*Secure\b/gi, '');
    updated = updated.replace(/;\s*Partitioned\b/gi, '');
    updated = updated.replace(/;\s*SameSite=None/gi, '; SameSite=Lax');
  }
  return updated;
}

function isRequestHttps(req: Request): boolean {
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return req.secure;
}

async function getIconBytes(): Promise<{ contentType: string; body: Buffer } | null> {
  if (cachedIconBuffer) return cachedIconBuffer;
  try {
    const resp = await fetch(ICON_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) return null;
    const arrayBuf = await resp.arrayBuffer();
    const contentType = resp.headers.get('content-type') || 'image/png';
    cachedIconBuffer = { contentType, body: Buffer.from(arrayBuf) };
    return cachedIconBuffer;
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);

  // Raw body parser only for /api routes so Vite middleware stays untouched
  app.use('/api', express.raw({ type: '*/*', limit: '50mb' }));

  // Custom brand icon endpoints
  app.get(['/favicon.ico', '/assets/img/logo.png'], async (_req: Request, res: Response) => {
    const icon = await getIconBytes();
    if (icon) {
      res.setHeader('Content-Type', icon.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(icon.body);
      return;
    }
    res.redirect(302, ICON_URL);
  });

  // UI SVG/PNG asset proxy (descriptionHeader.svg, defaultSubject.svg, teacher-placeholder.png, etc.)
  app.get('/assets/img/:filename', async (req: Request, res: Response) => {
    const filename = path.basename(String(req.params.filename || ''));
    if (!filename) {
      res.status(404).end();
      return;
    }

    if (filename === 'video-placeholder.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(VIDEO_PLACEHOLDER_SVG);
      return;
    }

    const cached = assetCache.get(filename);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).send(cached.body);
      return;
    }

    for (const origin of [ASSET_FALLBACK_ORIGIN, UPSTREAM_ORIGIN]) {
      try {
        const resp = await fetch(`${origin}/assets/img/${encodeURIComponent(filename)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!resp.ok) continue;
        const body = Buffer.from(await resp.arrayBuffer());
        const contentType = resp.headers.get('content-type') || 'application/octet-stream';
        assetCache.set(filename, { contentType, body });
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.status(200).send(body);
        return;
      } catch {
        // try next origin
      }
    }

    res.status(404).end();
  });

  // Manifest helper proxy if player needs CORS-free access to remote MPD / M3U8 URLs
  app.get('/api/play', async (req: Request, res: Response) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      res.status(400).json({ error: 'Missing url parameter' });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid url parameter' });
      return;
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      res.status(400).json({ error: 'Unsupported protocol' });
      return;
    }

    // Block loopback / private metadata hosts
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('169.254.') ||
      host === '::1'
    ) {
      res.status(403).json({ error: 'Blocked host' });
      return;
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Referer: 'https://www.pw.live/',
          Origin: 'https://www.pw.live',
        },
      });
      const ct = upstream.headers.get('content-type') || 'application/octet-stream';
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'no-store');
      res.status(upstream.status).send(buf);
    } catch (err) {
      console.error('Manifest proxy error:', err);
      res.status(502).json({ error: 'Failed to fetch manifest' });
    }
  });

  // Proxy all /api/* requests to physicswallah.studybeepro.in
  app.all('/api/*', async (req: Request, res: Response) => {
    try {
      const targetUrl = `${UPSTREAM_ORIGIN}${req.originalUrl}`;
      const isHttps = isRequestHttps(req);
      const isExplicitLogout = req.path === '/api/logout' || req.path === '/api/auth/logout';
      const isAuthHandshake =
        req.path === '/api/auth/login' ||
        req.path === '/api/auth/resend-otp' ||
        req.path === '/api/auth/verify-otp';

      // Start from browser cookies (if any), then layer decrypted X-GB-Session ON TOP
      // so stale third-party browser cookies never overwrite a newer verified session.
      const sessionJar = new Map<string, string>();
      mergeCookieHeader(sessionJar, req.headers.cookie);
      const tokenJar = decryptCookieJar(req.header('x-gb-session'));
      for (const [k, v] of tokenJar.entries()) {
        sessionJar.set(k, v);
      }

      // During a fresh OTP login/verify handshake, never send stale auth tokens upstream
      if (isAuthHandshake) {
        sessionJar.delete('accessToken');
        sessionJar.delete('refreshToken');
        sessionJar.delete('token');
      }

      const DEFAULT_BROWSER_UA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
      const ALLOWED_FORWARD_HEADERS = new Set([
        'accept',
        'accept-language',
        'content-type',
        'authorization',
        'user-agent',
        'range',
        'if-none-match',
        'if-modified-since',
      ]);

      const forwardHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        const lower = key.toLowerCase();
        if (!ALLOWED_FORWARD_HEADERS.has(lower) || value === undefined) continue;
        const joined = Array.isArray(value) ? value.join(', ') : value;
        if (lower === 'user-agent') {
          forwardHeaders['user-agent'] = joined.includes('Mozilla/') ? joined : DEFAULT_BROWSER_UA;
        } else {
          forwardHeaders[lower] = joined;
        }
      }
      if (!forwardHeaders['user-agent']) {
        forwardHeaders['user-agent'] = DEFAULT_BROWSER_UA;
      }
      forwardHeaders['origin'] = UPSTREAM_ORIGIN;
      forwardHeaders['referer'] = `${UPSTREAM_ORIGIN}/`;
      forwardHeaders['host'] = UPSTREAM_HOST;

      if (sessionJar.size > 0) {
        forwardHeaders['cookie'] = Array.from(sessionJar.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
      }

      const hasBody = !['GET', 'HEAD'].includes(req.method.toUpperCase());
      const bodyBuffer =
        hasBody && Buffer.isBuffer(req.body) && req.body.length > 0
          ? new Uint8Array(req.body)
          : undefined;

      const upstreamRes = await fetch(targetUrl, {
        method: req.method,
        headers: forwardHeaders,
        body: bodyBuffer,
        redirect: 'manual',
      });

      const skipResHeaders = new Set([
        'content-encoding',
        'content-length',
        'transfer-encoding',
        'connection',
        'keep-alive',
        'set-cookie',
        'x-frame-options',
        'content-security-policy',
        'location',
        'cache-control',
        'etag',
      ]);

      upstreamRes.headers.forEach((value, key) => {
        if (!skipResHeaders.has(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Vary', 'Cookie, X-GB-Session');

      const location = upstreamRes.headers.get('location');
      if (location) {
        const rewrittenLocation = location.startsWith(UPSTREAM_ORIGIN)
          ? location.slice(UPSTREAM_ORIGIN.length) || '/'
          : location;
        res.setHeader('Location', rewrittenLocation);
      }

      const setCookies = upstreamRes.headers.getSetCookie();
      if (setCookies.length > 0) {
        applySetCookies(sessionJar, setCookies, isExplicitLogout);
        const cookiesToForward = isExplicitLogout
          ? setCookies
          : setCookies.filter((c) => !isCookieDeletion(c));
        if (cookiesToForward.length > 0) {
          res.setHeader(
            'Set-Cookie',
            cookiesToForward.map((c) => rewriteSetCookie(c, isHttps)),
          );
        }
      }
      if (isExplicitLogout) {
        sessionJar.clear();
      }

      const contentType = upstreamRes.headers.get('content-type') || '';

      // Enforce brand overrides on /api/auth/serverInfo
      if (req.path === '/api/auth/serverInfo' && upstreamRes.ok) {
        const nextToken = encryptCookieJar(sessionJar);
        res.setHeader('X-GB-Session', nextToken);
        res.setHeader('Access-Control-Expose-Headers', 'X-GB-Session');
        const rawText = await upstreamRes.text();
        try {
          const info = JSON.parse(rawText) as Record<string, unknown>;
          info.webName = BRAND_NAME;
          info.sidebarTitle = BRAND_NAME;
          info.tg_channel = TELEGRAM_URL;
          info.tg_username = 'GBFreestudy';
          info.sidebarLogoUrl = ICON_URL;
          if (nextToken) info._session = nextToken;
          res.status(upstreamRes.status).json(info);
          return;
        } catch {
          res.status(upstreamRes.status).send(rewriteBrandText(rawText));
          return;
        }
      }

      const rawBuffer = Buffer.from(await upstreamRes.arrayBuffer());
      if (contentType.toLowerCase().includes('application/json') || contentType.toLowerCase().includes('text/')) {
        const rewrittenText = rewriteBrandText(rawBuffer.toString('utf8'));
        let jsonKeys = '';

        if (req.path.startsWith('/api/auth/') && upstreamRes.ok) {
          try {
            const parsed = JSON.parse(rewrittenText) as Record<string, any>;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              jsonKeys = Object.keys(parsed).join(',');
              if (req.path === '/api/auth/verify-otp') {
                const nested = parsed?.data && typeof parsed.data === 'object' ? parsed.data : {};
                const tokensObj = parsed?.tokens && typeof parsed.tokens === 'object' ? parsed.tokens : {};
                const userObj = parsed?.user && typeof parsed.user === 'object' ? parsed.user : {};
                const hdrAuth = upstreamRes.headers.get('authorization');
                const hdrAccess =
                  upstreamRes.headers.get('x-access-token') ||
                  upstreamRes.headers.get('x-auth-token') ||
                  (hdrAuth && /^Bearer\s+/i.test(hdrAuth) ? hdrAuth.replace(/^Bearer\s+/i, '').trim() : '');

                const accessCandidate =
                  parsed.accessToken ||
                  parsed.token ||
                  parsed.access_token ||
                  parsed.jwt ||
                  nested.accessToken ||
                  nested.token ||
                  nested.access_token ||
                  tokensObj.accessToken ||
                  tokensObj.token ||
                  userObj.accessToken ||
                  userObj.token ||
                  hdrAccess;
                const refreshCandidate =
                  parsed.refreshToken ||
                  parsed.refresh_token ||
                  nested.refreshToken ||
                  nested.refresh_token ||
                  tokensObj.refreshToken ||
                  tokensObj.refresh_token ||
                  userObj.refreshToken;

                if (typeof accessCandidate === 'string' && accessCandidate && !sessionJar.has('accessToken')) {
                  sessionJar.set('accessToken', accessCandidate);
                }
                if (typeof refreshCandidate === 'string' && refreshCandidate && !sessionJar.has('refreshToken')) {
                  sessionJar.set('refreshToken', refreshCandidate);
                }
                parsed._hasAuthCookie = Array.from(sessionJar.keys()).some((k) => k !== 'anon_id');
              }

              const nextToken = encryptCookieJar(sessionJar);
              res.setHeader('X-GB-Session', nextToken);
              res.setHeader('Access-Control-Expose-Headers', 'X-GB-Session');
              if (nextToken) parsed._session = nextToken;

              const setCookieNames =
                setCookies
                  .map((c) => {
                    const name = c.split('=')[0]?.trim();
                    return isCookieDeletion(c) ? `${name}(del)` : name;
                  })
                  .join(',') || 'none';
              const traceLine = `[Proxy] ${req.method} ${req.path} -> ${upstreamRes.status} | reqSession=${tokenJar.size > 0 ? Array.from(tokenJar.keys()).join(',') : 'none'} | setCookies=${setCookieNames} | jarOut=${Array.from(sessionJar.keys()).join(',') || 'none'} | keys=${jsonKeys}`;
              console.log(traceLine);
              appendProxyDebugLog(traceLine);

              res.status(upstreamRes.status).json(parsed);
              return;
            }
          } catch {
            // fall through
          }
        }

        if (
          req.path.startsWith('/api/auth/') ||
          req.path === '/api/AboutMe' ||
          req.path === '/api/AllBatches' ||
          req.path === '/api/todays-schedule'
        ) {
          const setCookieNames =
            setCookies
              .map((c) => {
                const name = c.split('=')[0]?.trim();
                return isCookieDeletion(c) ? `${name}(del)` : name;
              })
              .join(',') || 'none';
          const traceLine = `[Proxy] ${req.method} ${req.path} -> ${upstreamRes.status} | reqSession=${tokenJar.size > 0 ? Array.from(tokenJar.keys()).join(',') : 'none'} | setCookies=${setCookieNames} | jarOut=${Array.from(sessionJar.keys()).join(',') || 'none'}`;
          console.log(traceLine);
          appendProxyDebugLog(traceLine);
        }

        const nextToken = encryptCookieJar(sessionJar);
        res.setHeader('X-GB-Session', nextToken);
        res.setHeader('Access-Control-Expose-Headers', 'X-GB-Session');
        res.status(upstreamRes.status).send(Buffer.from(rewrittenText, 'utf8'));
        return;
      }

      const nextToken = encryptCookieJar(sessionJar);
      res.setHeader('X-GB-Session', nextToken);
      res.setHeader('Access-Control-Expose-Headers', 'X-GB-Session');
      res.status(upstreamRes.status).send(rawBuffer);
    } catch (error) {
      console.error('API proxy error:', error);
      res.status(502).json({ success: false, message: 'Unable to reach study backend server.' });
    }
  });

  // Frontend Vite middleware (dev) or static dist serving (prod)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('App build not found.');
      }
    });
  }

  const server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`${BRAND_NAME} server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
