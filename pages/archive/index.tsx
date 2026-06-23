import type { GetServerSideProps } from 'next';

/**
 * Archives are now merged into Request History (Requests section).
 * Permanent redirect keeps old bookmarks working.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/requests/history?tab=archives', permanent: true },
});

export default function LegacyArchiveRedirect() {
  return null;
}
