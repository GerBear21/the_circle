import ComingSoonPage from '../../../components/shared/ComingSoonPage';

export default function PettyCashComingSoonPage() {
  return (
    <ComingSoonPage
      title="Petty Cash Request"
      description="The petty cash request workflow is being prepared and will be available here soon."
      badge="Finance Form"
      backHref="/requests/new"
      backLabel="Back to Create New"
      icon={(
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
    />
  );
}
