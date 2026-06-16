import type { GetServerSideProps } from 'next';

/**
 * The request-centric audit trail now lives in the Audit section.
 * Permanent redirect keeps old bookmarks working.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/audit/transactions', permanent: true },
});

export default function LegacyArchiveAuditRedirect() {
  return null;
}
