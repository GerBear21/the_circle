import { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { sendGraphMail, getSignInviteEmailHtml } from "../../../lib/graphMail";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

interface Invitee {
  email: string;
  name?: string;
}

interface SendInvitesBody {
  documentName: string;
  /** PDF as base64 (data URL or raw base64). */
  pdfBase64: string;
  invitees: Invitee[];
  subject?: string;
  message?: string;
}

const BUCKET = "esign-documents";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ message: "Server not configured" });
  }

  // We need both the public session (for user metadata) AND the raw JWT
  // (which holds the Microsoft Graph access token — never exposed to the client).
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const jwtToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-build-only",
  });
  const accessToken = jwtToken?.ms_access_token as string | undefined;
  if (!accessToken) {
    return res.status(403).json({
      message:
        "Microsoft Graph access token unavailable. Please sign out and sign back in to grant Mail.Send permission.",
    });
  }

  const body = req.body as SendInvitesBody;
  if (!body?.pdfBase64 || !body?.documentName || !Array.isArray(body.invitees)) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const ALLOWED_DOMAIN = "rtg.co.zw";
  const cleanInvitees = body.invitees
    .map((i) => ({
      email: (i.email || "").trim().toLowerCase(),
      name: (i.name || "").trim() || undefined,
    }))
    .filter((i) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email));
  const invalidDomain = cleanInvitees.find(
    (i) => !i.email.endsWith(`@${ALLOWED_DOMAIN}`)
  );
  if (invalidDomain) {
    return res.status(400).json({
      message: `Only @${ALLOWED_DOMAIN} email addresses can be invited to sign (got ${invalidDomain.email}).`,
    });
  }
  if (cleanInvitees.length === 0) {
    return res.status(400).json({ message: "At least one valid invitee is required" });
  }
  if (cleanInvitees.length > 25) {
    return res.status(400).json({ message: "You can invite at most 25 signers per document" });
  }

  // ---- Upload PDF to Supabase storage ----
  const base64 = body.pdfBase64.replace(/^data:application\/pdf;base64,/, "");
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = Buffer.from(base64, "base64");
  } catch {
    return res.status(400).json({ message: "Invalid PDF data" });
  }

  const requesterId = (session.user as any).id as string | undefined;
  const requesterEmail = session.user.email || "";
  const requesterName = session.user.name || requesterEmail;
  const orgId = (session.user as any).org_id as string | undefined;

  const docId = crypto.randomUUID();
  const safeName = body.documentName.replace(/[^\w.\-]+/g, "_");
  const documentPath = `${orgId || "org"}/${requesterId || "user"}/${docId}/${safeName}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(documentPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadErr) {
    console.error("[esign send-invites] upload error:", uploadErr);
    return res.status(500).json({
      message: `Failed to store document: ${uploadErr.message}. Make sure the '${BUCKET}' bucket exists.`,
    });
  }

  // ---- Build base URL for signing links ----
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const baseUrl = process.env.NEXTAUTH_URL || `${proto}://${host}`;

  // ---- Create one invitation row per signer + send email ----
  const results: Array<{
    email: string;
    status: "sent" | "failed";
    error?: string;
    invitationId?: string;
  }> = [];

  for (const invitee of cleanInvitees) {
    const token = crypto.randomBytes(32).toString("hex");
    const subject =
      body.subject?.trim() ||
      `${requesterName} has requested your signature on "${body.documentName}"`;

    const { data: invitation, error: insertErr } = await supabaseAdmin
      .from("esign_invitations")
      .insert({
        organization_id: orgId,
        requester_id: requesterId,
        requester_email: requesterEmail,
        requester_name: requesterName,
        document_name: body.documentName,
        document_path: documentPath,
        signer_email: invitee.email,
        signer_name: invitee.name,
        subject,
        message: body.message?.trim() || null,
        token,
        status: "pending",
        sent_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (insertErr || !invitation) {
      console.error("[esign send-invites] insert error:", insertErr);
      results.push({
        email: invitee.email,
        status: "failed",
        error: insertErr?.message || "Database error",
      });
      continue;
    }

    const signingUrl = `${baseUrl}/esign/sign/${token}`;
    const html = getSignInviteEmailHtml({
      signerName: invitee.name,
      requesterName,
      documentName: body.documentName,
      signingUrl,
      message: body.message,
      expiresInDays: 30,
    });

    try {
      await sendGraphMail({
        accessToken,
        to: { email: invitee.email, name: invitee.name },
        subject,
        html,
      });
      results.push({
        email: invitee.email,
        status: "sent",
        invitationId: invitation.id,
      });
    } catch (mailErr: any) {
      console.error("[esign send-invites] mail error:", mailErr);
      // Roll the row back to a failed state so the requestor can retry.
      await supabaseAdmin
        .from("esign_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitation.id);
      results.push({
        email: invitee.email,
        status: "failed",
        error: mailErr?.message || "Failed to send email",
      });
    }
  }

  const sentCount = results.filter((r) => r.status === "sent").length;
  return res.status(200).json({
    success: sentCount > 0,
    sentCount,
    totalCount: results.length,
    results,
    sender: requesterEmail,
  });
}
