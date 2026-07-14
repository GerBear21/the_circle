import React from 'react';

/**
 * A supporting document being attached to a request. `file` is set for
 * newly-picked files; `existing` is set for documents already uploaded (edit
 * mode) which can't be re-read from disk but can still be shown/removed.
 */
export interface SupportingDoc {
  id: string;
  file: File | null;
  label: string;
  description: string;
  existing?: {
    id: string;
    filename: string;
    download_url?: string | null;
  } | null;
}

export function makeSupportingDoc(partial?: Partial<SupportingDoc>): SupportingDoc {
  return {
    id: Math.random().toString(36).slice(2),
    file: null,
    label: '',
    description: '',
    existing: null,
    ...partial,
  };
}

interface SupportingDocumentsProps {
  documents: SupportingDoc[];
  onChange: (docs: SupportingDoc[]) => void;
  disabled?: boolean;
  title?: string;
  helpText?: string;
  acceptedTypes?: string;
}

/**
 * Reusable "supporting documents" editor: a list of file + label + description
 * rows with add/remove. Used by the travel authorization form and the travel
 * section of complimentary bookings.
 */
export function SupportingDocuments({
  documents,
  onChange,
  disabled,
  title = 'Supporting Documents',
  helpText = 'Attach any supporting documents (e.g. invitations, quotations, itineraries). Give each a short label and description.',
  acceptedTypes = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx',
}: SupportingDocumentsProps) {
  const update = (id: string, patch: Partial<SupportingDoc>) => {
    onChange(documents.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };
  const remove = (id: string) => onChange(documents.filter((d) => d.id !== id));
  const add = () => onChange([...documents, makeSupportingDoc()]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <p className="text-xs text-text-secondary mt-0.5">{helpText}</p>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add document
        </button>
      </div>

      {documents.length === 0 && (
        <p className="text-xs text-text-secondary italic">No supporting documents attached.</p>
      )}

      {documents.map((doc, index) => (
        <div key={doc.id} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Document {index + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(doc.id)}
              disabled={disabled}
              className="text-danger-600 hover:text-danger-700 text-xs font-medium disabled:opacity-50"
            >
              Remove
            </button>
          </div>

          {doc.existing ? (
            <div className="text-sm text-text-primary flex items-center gap-2">
              <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {doc.existing.download_url ? (
                <a href={doc.existing.download_url} target="_blank" rel="noopener noreferrer" className="text-primary-700 hover:underline">
                  {doc.existing.filename}
                </a>
              ) : (
                <span>{doc.existing.filename}</span>
              )}
            </div>
          ) : (
            <input
              type="file"
              accept={acceptedTypes}
              disabled={disabled}
              onChange={(e) => update(doc.id, { file: e.target.files?.[0] || null })}
              className="block w-full text-sm text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          )}

          <input
            type="text"
            value={doc.label}
            disabled={disabled}
            onChange={(e) => update(doc.id, { label: e.target.value })}
            placeholder="Label (e.g. Conference invitation)"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm"
          />
          <textarea
            value={doc.description}
            disabled={disabled}
            onChange={(e) => update(doc.id, { description: e.target.value })}
            placeholder="Description — what is this document and why is it attached?"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-1 focus:ring-primary-500 outline-none text-sm resize-y"
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Upload the newly-picked supporting documents to a created request. Existing
 * documents (edit mode) are skipped. Best-effort per file; returns the count
 * uploaded. Callers typically run this right after the request is created.
 */
export async function uploadSupportingDocuments(
  requestId: string,
  documents: SupportingDoc[]
): Promise<number> {
  let uploaded = 0;
  for (const doc of documents) {
    if (!doc.file) continue;
    const formData = new FormData();
    formData.append('file', doc.file);
    if (doc.label) formData.append('label', doc.label);
    if (doc.description) formData.append('description', doc.description);
    try {
      const res = await fetch(`/api/requests/${requestId}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) uploaded += 1;
      else console.error('Supporting document upload failed:', await res.text());
    } catch (e) {
      console.error('Supporting document upload error:', e);
    }
  }
  return uploaded;
}
