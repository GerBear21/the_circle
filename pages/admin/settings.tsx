import { GetServerSideProps } from 'next';

// System Configuration is now split into dedicated pages under the
// Administrator section of the sidebar. Redirect the old entry point to the
// first section so existing links keep working.
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/admin/settings/slas',
      permanent: false,
    },
  };
};

export default function AdminSettingsRedirect() {
  return null;
}
