import React, { useEffect, useState } from 'react';
import { fetchServerInfo, resendOtpApi, sendOtpApi, verifyOtpApi } from '../lib/api';
import { BRAND_NAME, ICON_URL, TELEGRAM_URL } from '../lib/constants';
import { useRouter, useSearchParams } from '../lib/router';

export function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [smsType, setSmsType] = useState<'0' | '1'>('1');
  const [timer, setTimer] = useState(30);
  const [tgBotUrl, setTgBotUrl] = useState<string>('');

  const digits = phone.replace(/\D/g, '');

  useEffect(() => {
    fetchServerInfo().then((info) => {
      if (info.tg_bot) {
        const handle = String(info.tg_bot).replace('@', '').trim();
        if (handle) setTgBotUrl(`https://t.me/${handle}`);
      }
    });
  }, []);

  useEffect(() => {
    if (step !== 'otp' || timer <= 0) return;
    const id = window.setInterval(() => {
      setTimer((t) => Math.max(0, t - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [step, timer]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('');
    setErrorMsg('');
    if (!/^\d{10}$/.test(digits)) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const data = await sendOtpApi(digits, smsType);
      setStep('otp');
      setTimer(30);
      setStatusMsg(
        data?.message ||
          (smsType === '1'
            ? 'OTP sent on WhatsApp successfully.'
            : 'OTP sent via SMS successfully. Enter it below.'),
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (type: '0' | '1') => {
    if (timer > 0 || loading) return;
    setSmsType(type);
    setStatusMsg('');
    setErrorMsg('');
    setLoading(true);
    try {
      const data = await resendOtpApi(digits, type);
      setTimer(30);
      setStatusMsg(
        data?.message ||
          (type === '1' ? 'OTP resent on WhatsApp.' : 'OTP resent via SMS.'),
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('');
    setErrorMsg('');
    if (!/^\d{4,6}$/.test(otp.trim())) {
      setErrorMsg('Please enter a valid OTP.');
      return;
    }
    setLoading(true);
    try {
      const data = await verifyOtpApi(digits, otp.trim());
      if (data?.user) {
        try {
          localStorage.setItem('USER_DATA', JSON.stringify(data.user));
        } catch {
          // ignore
        }
      }
      setStatusMsg(data?.message || 'OTP verified successfully.');
      const rawRedirect = searchParams.get('redirect') || '/study';
      const safeTarget =
        rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') && !rawRedirect.startsWith('/auth')
          ? rawRedirect
          : '/study';
      router.replace(safeTarget);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full overflow-hidden border bg-muted shrink-0">
            <img
              src={ICON_URL}
              alt={BRAND_NAME}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">{BRAND_NAME}</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            {step === 'mobile' ? 'Welcome back' : 'Verify OTP'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === 'mobile'
              ? 'Enter your mobile number to receive an OTP.'
              : `Enter the OTP sent to +91 ${digits}.`}
          </p>
        </div>

        {step === 'mobile' ? (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label htmlFor="mobile" className="mb-2 block text-sm font-medium">
                Mobile number
              </label>
              <div className="flex overflow-hidden rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                <span className="flex items-center border-r border-input px-3 text-sm text-muted-foreground">
                  +91
                </span>
                <input
                  id="mobile"
                  name="mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  placeholder="Enter mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSmsType('1')}
                className={`flex-1 rounded-lg border px-3 py-2 font-medium transition-colors ${
                  smsType === '1'
                    ? 'border-[#5a4bda] bg-[#5a4bda]/10 text-[#5a4bda] dark:text-[#a59bff]'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                WhatsApp OTP
              </button>
              <button
                type="button"
                onClick={() => setSmsType('0')}
                className={`flex-1 rounded-lg border px-3 py-2 font-medium transition-colors ${
                  smsType === '0'
                    ? 'border-[#5a4bda] bg-[#5a4bda]/10 text-[#5a4bda] dark:text-[#a59bff]'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                SMS OTP
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </div>
            )}
            {statusMsg && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                {statusMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || digits.length !== 10}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>

            <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#5a4bda] hover:underline dark:text-[#29ff94]"
              >
                Join Telegram Channel
              </a>
              {tgBotUrl && (
                <a
                  href={tgBotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Open Bot
                </a>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label htmlFor="otp" className="mb-2 block text-sm font-medium">
                OTP
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-center text-lg tracking-[0.35em] outline-none focus:ring-2 focus:ring-ring"
                autoFocus
                disabled={loading}
              />
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </div>
            )}
            {statusMsg && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                {statusMsg}
              </div>
            )}

            <div className="space-y-3">
              <button
                type="submit"
                disabled={loading || otp.length < 4}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <div className="flex items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  disabled={loading || timer > 0}
                  onClick={() => handleResend('0')}
                  className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
                </button>
                <button
                  type="button"
                  disabled={loading || timer > 0}
                  onClick={() => handleResend('1')}
                  className="font-medium text-primary hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {timer > 0 ? `Send on WhatsApp in ${timer}s` : 'Send on WhatsApp'}
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setStep('mobile');
                setOtp('');
                setSmsType('1');
                setTimer(30);
                setStatusMsg('');
                setErrorMsg('');
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Change mobile number
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
