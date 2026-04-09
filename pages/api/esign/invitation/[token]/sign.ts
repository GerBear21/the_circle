import { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const config = {
  api: { bodyParser: { sizeLimit: "25mb" } },
};

const BUCKET = "esign-documents";

/**
 * Public endpoint — invitee submits the signed PDF for an invitation.
 * No session is required; access is gated by the random token.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ message: "Server not configured" });
  }

  const { token } = req.query;
  if (typeof token !== "string" || !/^[a-f0-9]{32,128}$/i.test(token)) {
    return res.status(400).json({ message: "Invalid token" });
  }

  const { signedPdfBase64, signerName } = req.body || {};
  if (typeof signedPdfBase64 !== "string" || signedPdfBase64.length < 100) {
    return res.status(400).json({ message: "Missing signed PDF data" });
  }

  const { data: invitation, error: lookupErr } = await supabaseAdmin
    .from("esign_invitations")
    .select("id, status, document_path, document_name, expires_at")
    .eq("token", token)
    .single();

  if (lookupErr || !invitation) {
    return res.status(404).json({ message: "Invitation not found" });
  }
  if (invitation.status === "signed") {
    return res.status(409).json({ message: "Document already signed" });
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ message: "This signing link has expired" });
  }

  const base64 = signedPdfBase64.replace(/^data:application\/pdf;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  // Save signed PDF alongside the original (suffix _signed_<id>.pdf)
  const signedPath = invitation.document_path.replace(
    /(\.pdf)?$/i,
    `_signed_${invitation.id}.pdf`
  );

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(signedPath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadErr) {
    console.error("[esign sign] upload error:", uploadErr);
    return res.status(500).json({ message: `Failed to save signed document: ${uploadErr.message}` });
  }

  const update: Record<string, unknown> = {
    status: "signed",
    signed_at: new Date().toISOString(),
    signed_path: signedPath,
  };
  if (signerName && typeof signerName === "string") update.signer_name = signerName;

  const { error: updateErr } = await supabaseAdmin
    .from("esign_invitations")
    .update(update)
    .eq("id", invitation.id);
  if (updateErr) {
    console.error("[esign sign] update error:", updateErr);
    return res.status(500).json({ message: "Failed to record signature" });
  }

  return res.status(200).json({ success: true });
}
