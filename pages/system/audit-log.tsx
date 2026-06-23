import type { GetServerSideProps } from 'next';

/**
 * The system audit log now lives in the dedicated Audit section, backed by the
 * immutable, hash-chained `audit_events` log (real data for every user — not
 * the old placeholder table this page used to render). Redirect keeps any old
 * bookmarks working.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/audit/logs', permanent: true },
});

export default function LegacySystemAuditLogRedirect() {
  return null;
}
