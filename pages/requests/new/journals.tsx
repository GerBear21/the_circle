import ComingSoonPage from '../../../components/shared/ComingSoonPage';

export default function JournalsComingSoonPage() {
  return (
    <ComingSoonPage
      title="Journals"
      description="The journals request workflow is coming soon and will be launched from this page."
      badge="Finance Form"
      backHref="/requests/new"
      backLabel="Back to Create New"
      icon={(
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.5 21h13a2 2 0 002-2V7.5a2 2 0 00-.586-1.414l-3-3A2 2 0 0015.5 3h-10a2 2 0 00-2 2v14a2 2 0 002 2zm3-12h7m-7 4h7m-7 4h4" />
        </svg>
      )}
    />
  );
}
