import { useEffect, useState, ComponentType } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import Head from "next/head";

interface PublicPdfSignerProps {
  pdfUrl: string;
  signerName?: string;
  onSave: (signedPdfBlob: Blob) => void;
  onCancel: () => void;
}

// PublicPdfSigner relies on react-pdf which must be loaded client-side only.
const PublicPdfSigner = dynamic<PublicPdfSignerProps>(
  () =>
    import("../../../components/esign/PublicPdfSigner") as Promise<{
      default: ComponentType<PublicPdfSignerProps>;
    }>,
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    ),
  }
);

interface InvitationData {
  id: string;
  status: "pending" | "viewed" | "signed" | "expired" | "cancelled";
  documentName: string;
  pdfUrl: string | null;
  signerName?: string;
  signerEmail?: string;
  requesterName?: string;
  requesterEmail?: string;
  subject?: string;
  message?: string;
  expiresAt?: string;
}

export default function ESignInvitePage() {
  const router = useRouter();
  const { token } = router.query;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token || typeof token !== "string") return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch(`/api/esign/invitation/${token}`);
        const data = await resp.json();
        if (cancelled) return;
        if (!resp.ok) {
          setError(data?.message || "Unable to load invitation");
        } else {
          setInvitation(data);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSave = async (signedBlob: Blob) => {
    if (!token || typeof token !== "string") return;
    setSubmitting(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(signedBlob);
      });
      const resp = await fetch(`/api/esign/invitation/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedPdfBase64: base64,
          signerName: invitation?.signerName,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || "Failed to submit signature");
      setSubmitted(true);
    } catch (e: any) {
      alert(e?.message || "Failed to submit signature");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign Document — The Circle</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-[#FAF6F1] to-[#FAF6F1]">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-semibold text-gray-900 leading-tight">The Circle</h1>
                <p className="text-xs text-gray-500">Electronic Signature</p>
              </div>
            </div>
            {invitation?.expiresAt && !submitted && (
              <div className="text-xs text-gray-500">
                Link expires {new Date(invitation.expiresAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8">
          {loading && (
            <div className="flex items-center justify-center h-[50vh]">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
            </div>
          )}

          {!loading && error && (
            <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load document</h2>
              <p className="text-gray-600">{error}</p>
            </div>
          )}

          {!loading && invitation?.status === "signed" && !submitted && (
            <SuccessCard
              title="Already signed"
              message="This document has already been signed. Thank you!"
            />
          )}

          {!loading && submitted && (
            <SuccessCard
              title="Signature submitted"
              message={`Thanks${invitation?.signerName ? `, ${invitation.signerName}` : ""}! Your signed copy has been delivered to ${invitation?.requesterName || "the requester"}.`}
            />
          )}

          {!loading && invitation && invitation.pdfUrl && !submitted && invitation.status !== "signed" && (
            <>
              {!accepted ? (
                <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="px-8 pt-8 pb-6">
                    <p className="text-sm font-medium text-primary-600 uppercase tracking-wide mb-2">Signature Request</p>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">{invitation.documentName}</h2>
                    <p className="text-sm text-gray-500">
                      From <span className="font-medium text-gray-700">{invitation.requesterName}</span>{" "}
                      &lt;{invitation.requesterEmail}&gt;
                    </p>
                  </div>
                  {invitation.message && (
                    <div className="mx-8 mb-6 p-4 bg-[#F3EADC] border-l-4 border-[#9A7545] rounded-r-lg">
                      <p className="text-xs font-semibold text-[#5E4426] uppercase tracking-wide mb-1">Message</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{invitation.message}</p>
                    </div>
                  )}
                  <div className="px-8 pb-6">
                    <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        By clicking <strong>Continue to sign</strong>, you agree that your electronic signature
                        is the legal equivalent of your handwritten signature on this document.
                      </p>
                    </div>
                  </div>
                  <div className="px-8 pb-8 flex gap-3">
                    <button
                      onClick={() => setAccepted(true)}
                      className="flex-1 px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors shadow-sm"
                    >
                      Continue to sign
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden h-[80vh]">
                  <PublicPdfSigner
                    pdfUrl={invitation.pdfUrl}
                    signerName={invitation.signerName}
                    onSave={handleSave}
                    onCancel={() => setAccepted(false)}
                  />
                </div>
              )}
            </>
          )}

          {submitting && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl px-8 py-6 flex items-center gap-4 shadow-2xl">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
                <span className="text-gray-700 font-medium">Submitting signature…</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SuccessCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600">{message}</p>
    </div>
  );
}

// Public page — bypass any default auth requirements
ESignInvitePage.requireAuth = false;
