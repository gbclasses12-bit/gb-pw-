import React, { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { AppShell } from './components/AppShell';
import { RouterProvider, usePathname, useRouter } from './lib/router';
import { AuthPage } from './pages/AuthPage';
import { BatchDetailPage } from './pages/BatchDetailPage';
import { BatchesPage } from './pages/BatchesPage';
import { ContactPage } from './pages/ContactPage';
import { HistoryPage } from './pages/HistoryPage';
import { MyBatchesPage } from './pages/MyBatchesPage';
import { StudyPage } from './pages/StudyPage';
import { SubjectChaptersPage } from './pages/SubjectChaptersPage';
import { TopicsPage } from './pages/TopicsPage';
import { WatchPage } from './pages/WatchPage';
import { WeeklySchedulePage } from './pages/WeeklySchedulePage';

function NetworkListener() {
  useEffect(() => {
    const onOnline = () => toast.success('✅ You are back online');
    const onOffline = () => toast.error('⚠️ You are offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return null;
}

function RouteView() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === '/' || pathname === '') {
      router.replace('/study');
    }
  }, [pathname, router]);

  if (pathname === '/auth' || pathname.startsWith('/auth/')) {
    return <AuthPage />;
  }
  if (pathname === '/watch' || pathname.startsWith('/watch/')) {
    return <WatchPage isLive={false} />;
  }
  if (pathname === '/live' || pathname.startsWith('/live/')) {
    return <WatchPage isLive={true} />;
  }
  if (pathname === '/history' || pathname.startsWith('/history/')) {
    return <HistoryPage />;
  }
  if (pathname === '/contact' || pathname.startsWith('/contact/')) {
    return <ContactPage />;
  }
  if (pathname === '/weekly-schedule' || pathname.startsWith('/weekly-schedule/')) {
    return <WeeklySchedulePage />;
  }
  if (pathname === '/study/mybatches' || pathname.startsWith('/study/mybatches/')) {
    return <MyBatchesPage />;
  }
  if (pathname === '/study/batches' || pathname === '/study/batches/') {
    return <BatchesPage />;
  }

  const topicMatch = pathname.match(
    /^\/study\/batches\/([^/]+)\/subjects\/([^/]+)\/subject-topics\/([^/]+)\/?$/,
  );
  if (topicMatch) {
    return (
      <TopicsPage
        batchId={decodeURIComponent(topicMatch[1])}
        subjectId={decodeURIComponent(topicMatch[2])}
        topicId={decodeURIComponent(topicMatch[3])}
      />
    );
  }

  const subjectMatch = pathname.match(/^\/study\/batches\/([^/]+)\/subjects\/([^/]+)\/?$/);
  if (subjectMatch) {
    return (
      <SubjectChaptersPage
        batchId={decodeURIComponent(subjectMatch[1])}
        subjectId={decodeURIComponent(subjectMatch[2])}
      />
    );
  }

  const batchMatch = pathname.match(/^\/study\/batches\/([^/]+)\/?$/);
  if (batchMatch) {
    return <BatchDetailPage batchId={decodeURIComponent(batchMatch[1])} />;
  }

  return <StudyPage />;
}

export default function App() {
  return (
    <RouterProvider>
      <NetworkListener />
      <Toaster position="top-center" richColors />
      <AppShell>
        <RouteView />
      </AppShell>
    </RouterProvider>
  );
}
