import React, { useEffect, useState } from 'react';
import { MessageSquare, Rocket, Send } from 'lucide-react';
import { fetchServerInfo } from '../lib/api';
import { BRAND_NAME, ICON_URL, TELEGRAM_URL } from '../lib/constants';

export function ContactPage() {
  const [tgBot, setTgBot] = useState('');

  useEffect(() => {
    fetchServerInfo().then((info) => {
      if (info.tg_bot) {
        const handle = String(info.tg_bot).replace('@', '').trim();
        if (handle) setTgBot(`https://t.me/${handle}`);
      }
    });
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 max-w-[1400px]">
      <div className="bg-background border rounded-lg p-4 sm:p-6 mb-6 divshadow">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-semibold">About {BRAND_NAME}</h1>
            <p className="text-muted-foreground mt-1">
              Your study companion for live classes, schedules, and resources — designed to be fast,
              clean, and distraction-free.
            </p>
          </div>
          <img
            src={ICON_URL}
            alt={BRAND_NAME}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-md border object-cover shrink-0"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-md border bg-background/60">Secure</span>
          <span className="px-2 py-1 rounded-md border bg-background/60">Reliable</span>
          <span className="px-2 py-1 rounded-md border bg-background/60">Responsive</span>
        </div>
      </div>

      <div className="bg-background border rounded-lg p-4 sm:p-6 mb-6 divshadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-4 h-4" />
              <h2 className="font-medium">Official Telegram Channel</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Get the latest batch updates, notes, and announcements.
            </p>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 w-full md:w-auto"
            >
              Join Channel
            </a>
          </div>

          <div className="rounded-lg border p-4 bg-background/50">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4" />
              <h2 className="font-medium">Community &amp; Support</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Reach out on Telegram for batch help, feedback, or technical support.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Open Telegram
              </a>
              {tgBot && (
                <a
                  href={tgBot}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Telegram Bot
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-background border rounded-lg p-4 sm:p-6 divshadow">
        <div className="flex items-center gap-2 mb-2">
          <Rocket className="w-4 h-4 text-[#7567ee]" />
          <h2 className="font-medium">Status &amp; Info</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-2 py-1 rounded-md border bg-green-500/10 text-green-600 dark:text-green-400">
            All Batches Active
          </span>
          <span className="px-2 py-1 rounded-md border bg-background/60">100% Free For Students</span>
        </div>
      </div>
    </div>
  );
}
