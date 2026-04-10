import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const BUCKET = "esign-documents";

/**
 * Public endpoint (no session required) — looks up an e-sign invitation by
 * its random token and returns metadata + a short-lived signed URL the
 * invitee can use to download the source PDF.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ message: "Server not configured" });
  }

  const { token } = req.query;
  if (typeof token !== "string" || !/^[a-f0-9]{32,128}$/i.test(token)) {
    return res.status(400).json({ message: "Invalid token" });
  }

  const { data: invitation, error } = await supabaseAdmin
    .from("esign_invitations")
    .select(
      "id, status, document_name, document_path, signer_name, signer_email, requester_name, requester_email, subject, message, expires_at, signed_at"
    )
    .eq("token", token)
    .single();

  if (error || !invitation) {
    return res.status(404).json({ message: "Invitation not found" });
  }

  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    if (invitation.status !== "expired") {
      await supabaseAdmin
        .from("esign_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
    }
    return res.status(410).json({ message: "This signing link has expired", status: "expired" });
  }

  if (invitation.status === "signed") {
    return res
      .status(200)
      .json({ ...invitation, status: "signed", signedPdfUrl: null, pdfUrl: null });
  }

  // Mark viewed (first view only)
  if (invitation.status === "pending") {
    await supabaseAdmin
      .from("esign_invitations")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", invitation.id);
  }

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(invitation.document_path, 60 * 30); // 30 minutes

  if (signErr || !signed?.signedUrl) {
    console.error("[esign invitation] signed URL error:", signErr);
    return res.status(500).json({ message: "Failed to load document" });
  }

  return res.status(200).json({
    id: invitation.id,
    status: invitation.status === "pending" ? "viewed" : invitation.status,
    documentName: invitation.document_name,
    pdfUrl: signed.signedUrl,
    signerName: invitation.signer_name,
    signerEmail: invitation.signer_email,
    requesterName: invitation.requester_name,
    requesterEmail: invitation.requester_email,
    subject: invitation.subject,
    message: invitation.message,
    expiresAt: invitation.expires_at,
  });
}
