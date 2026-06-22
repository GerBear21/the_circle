import type { GetServerSideProps } from 'next';

/**
 * The activity monitor now lives in the dedicated Audit section. The real
 * user-activity feed (every user's day-to-day actions, from the immutable
 * audit log) is at /audit/activity — this page previously rendered only
 * placeholder/mock data. Redirect keeps old bookmarks working.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/audit/activity', permanent: true },
});

export default function LegacyActivityMonitorRedirect() {
  return null;
}
