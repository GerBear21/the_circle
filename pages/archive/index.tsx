import type { GetServerSideProps } from 'next';

/**
 * Archives are now merged into the My Requests page (Archived Documents tab).
 * Permanent redirect keeps old bookmarks working.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/requests/my-requests?tab=archives', permanent: true },
});

export default function LegacyArchiveRedirect() {
  return null;
}
