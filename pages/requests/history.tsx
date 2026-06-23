import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/layout';
import RequestsView from '../../components/requests/RequestsView';
import ArchiveView from '../../components/requests/ArchiveView';
import { History, Archive } from 'lucide-react';

type HistoryTab = 'requests' | 'archives';

/**
 * Request History & Archives — the merged record of completed requests.
 * "Requests" lists every finished request (approved / rejected / withdrawn /
 * cancelled); "Archived Documents" holds the signed PDF for every fully
 * reviewed request, generated automatically on final approval and
 * re-generatable on demand.
 */
export default function RequestHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<HistoryTab>('requests');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  // Allow deep-links: /requests/history?tab=archives (also used by the old
  // /archive redirect).
  useEffect(() => {
    if (router.query.tab === 'archives') setTab('archives');
  }, [router.query.tab]);

  if (status === 'loading') {
    return (
      <AppLayout title="History & Archives">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return null;

  const switchTab = (next: HistoryTab) => {
    setTab(next);
    router.replace(
      { pathname: '/requests/history', query: next === 'archives' ? { tab: 'archives' } : {} },
      undefined,
      { shallow: true }
    );
  };

  return (
    <AppLayout title="History & Archives">
      <div className="px-4 sm:px-6 pt-4 max-w-7xl mx-auto">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => switchTab('requests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'requests' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <History className="w-4 h-4" strokeWidth={1.5} />
            Request History
          </button>
          <button
            onClick={() => switchTab('archives')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'archives' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Archive className="w-4 h-4" strokeWidth={1.5} />
            Archived Documents
          </button>
        </div>
      </div>

      {tab === 'requests' ? (
        <RequestsView mode="history" />
      ) : (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          <ArchiveView />
        </div>
      )}
    </AppLayout>
  );
}
