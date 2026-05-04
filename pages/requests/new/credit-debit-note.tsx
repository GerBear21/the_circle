import ComingSoonPage from '../../../components/shared/ComingSoonPage';

export default function CreditDebitNoteComingSoonPage() {
  return (
    <ComingSoonPage
      title="Credit / Debit Note"
      description="The credit and debit note form is planned and will open from this page once it is ready."
      badge="Finance Form"
      backHref="/requests/new"
      backLabel="Back to Create New"
      icon={(
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )}
    />
  );
}
