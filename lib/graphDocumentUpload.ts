/**
 * Sync approved request PDFs into the Microsoft 365 ecosystem — Teams
 * channel, SharePoint library, the requester's OneDrive, and Outlook email —
 * via Microsoft Graph using the app's own identity (client-credentials).
 * No third-party services.
 *
 * The PDF is the archive already generated on full approval (Supabase
 * `archives` bucket). We download it and push the bytes to Graph.
 *
 * Configuration (all optional — each target is skipped if unset, and the whole
 * thing degrades to a no-op so approvals never break):
 *   Teams channel:
 *     GRAPH_TEAM_ID, GRAPH_CHANNEL_ID
 *   SharePoint document library:
 *     GRAPH_SHAREPOINT_DRIVE_ID            (a document-library drive id), or
 *     GRAPH_SHAREPOINT_SITE_ID             (resolve the site's default drive)
 *     GRAPH_SHAREPOINT_FOLDER (optional)   sub-folder path, e.g. "Approved/CAPEX"
 *   OneDrive (per-user):
 *     GRAPH_ONEDRIVE_ENABLED=true          upload into the requester's OneDrive
 *     GRAPH_ONEDRIVE_FOLDER (optional)     defaults to "The Circle Approvals"
 *   Outlook:
 *     GRAPH_MAIL_SENDER                    service mailbox (lib/graphAppMail)
 *
 * Required Graph **application** permissions (admin consent):
 *   Sites.ReadWrite.All (Teams channel files + SharePoint), Files.ReadWrite.All
 *   (user OneDrive), Mail.Send (Outlook).
 */

import { supabaseAdmin } from './supabaseAdmin';
import { getAppToken, sendAppGraphMail } from './graphAppMail';

const GRAPH = 'https://graph.microsoft.com/v1.0';

function sanitizeFileName(name: string): string {
  // Graph rejects these characters in drive item names.
  return (name || 'document').replace(/[\\/:*?"<>|#%]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 180);
}

async function downloadArchivePdf(storagePath: string): Promise<Buffer | null> {
  try {
    const { data, error } = await supabaseAdmin.storage.from('archives').download(storagePath);
    if (error || !data) {
      console.error('graphDocumentUpload: archive download failed:', error);
      return null;
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (e) {
    console.error('graphDocumentUpload: archive download threw:', e);
    return null;
  }
}

/** PUT bytes to a drive location; returns the created item's webUrl, or null. */
async function putPdf(token: string, url: string, pdf: Buffer): Promise<string | null> {
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' },
    body: pdf,
  });
  if (!resp.ok) {
    console.error('graphDocumentUpload: drive PUT failed:', resp.status, await resp.text().catch(() => ''));
    return null;
  }
  const item: any = await resp.json().catch(() => null);
  return item?.webUrl || '';
}

async function uploadToTeams(token: string, fileName: string, pdf: Buffer): Promise<string | null> {
  const teamId = process.env.GRAPH_TEAM_ID;
  const channelId = process.env.GRAPH_CHANNEL_ID;
  if (!teamId || !channelId) return null;
  try {
    // The channel's Files tab maps to a SharePoint folder (a driveItem).
    const folderResp = await fetch(`${GRAPH}/teams/${teamId}/channels/${channelId}/filesFolder`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!folderResp.ok) {
      console.error('graphDocumentUpload: filesFolder lookup failed:', folderResp.status, await folderResp.text().catch(() => ''));
      return null;
    }
    const folder: any = await folderResp.json();
    const driveId = folder?.parentReference?.driveId;
    const itemId = folder?.id;
    if (!driveId || !itemId) {
      console.error('graphDocumentUpload: channel filesFolder missing drive/item id');
      return null;
    }
    return await putPdf(token, `${GRAPH}/drives/${driveId}/items/${itemId}:/${encodeURIComponent(fileName)}:/content`, pdf);
  } catch (e) {
    console.error('graphDocumentUpload: Teams upload threw:', e);
    return null;
  }
}

async function resolveSharePointDriveId(token: string): Promise<string | null> {
  if (process.env.GRAPH_SHAREPOINT_DRIVE_ID) return process.env.GRAPH_SHAREPOINT_DRIVE_ID;
  const siteId = process.env.GRAPH_SHAREPOINT_SITE_ID;
  if (!siteId) return null;
  try {
    const resp = await fetch(`${GRAPH}/sites/${siteId}/drive`, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      console.error('graphDocumentUpload: site drive lookup failed:', resp.status);
      return null;
    }
    const drive: any = await resp.json();
    return drive?.id || null;
  } catch (e) {
    console.error('graphDocumentUpload: site drive lookup threw:', e);
    return null;
  }
}

async function uploadToSharePoint(token: string, fileName: string, pdf: Buffer): Promise<string | null> {
  const driveId = await resolveSharePointDriveId(token);
  if (!driveId) return null;
  const folder = (process.env.GRAPH_SHAREPOINT_FOLDER || '').replace(/^\/+|\/+$/g, '');
  const path = folder ? `${folder}/${fileName}` : fileName;
  try {
    return await putPdf(
      token,
      `${GRAPH}/drives/${driveId}/root:/${path.split('/').map(encodeURIComponent).join('/')}:/content`,
      pdf
    );
  } catch (e) {
    console.error('graphDocumentUpload: SharePoint upload threw:', e);
    return null;
  }
}

/**
 * Upload into a specific user's OneDrive (app permission Files.ReadWrite.All).
 * Lands under "The Circle Approvals/" (configurable via GRAPH_ONEDRIVE_FOLDER).
 */
async function uploadToUserOneDrive(token: string, userEmail: string, fileName: string, pdf: Buffer): Promise<string | null> {
  const folder = sanitizeFileName(process.env.GRAPH_ONEDRIVE_FOLDER || 'The Circle Approvals');
  try {
    return await putPdf(
      token,
      `${GRAPH}/users/${encodeURIComponent(userEmail)}/drive/root:/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}:/content`,
      pdf
    );
  } catch (e) {
    console.error('graphDocumentUpload: OneDrive upload threw:', e);
    return null;
  }
}

export function isDocumentUploadConfigured(): boolean {
  return !!(
    (process.env.GRAPH_TEAM_ID && process.env.GRAPH_CHANNEL_ID) ||
    process.env.GRAPH_SHAREPOINT_DRIVE_ID ||
    process.env.GRAPH_SHAREPOINT_SITE_ID ||
    process.env.GRAPH_ONEDRIVE_ENABLED === 'true' ||
    process.env.GRAPH_MAIL_SENDER
  );
}

export interface MicrosoftSyncResult {
  teams: boolean;
  sharepoint: boolean;
  onedrive: boolean;
  email: boolean;
  /** Web links to the uploaded copies, where Graph returned them. */
  links: { teams?: string; sharepoint?: string; onedrive?: string };
}

const EMPTY_RESULT = (): MicrosoftSyncResult => ({
  teams: false, sharepoint: false, onedrive: false, email: false, links: {},
});

function approvalEmailHtml(params: {
  title: string;
  referenceCode?: string | null;
  links: MicrosoftSyncResult['links'];
}): string {
  const linkRows = [
    params.links.onedrive && `<li><a href="${params.links.onedrive}">Open in your OneDrive</a></li>`,
    params.links.sharepoint && `<li><a href="${params.links.sharepoint}">Open in SharePoint</a></li>`,
    params.links.teams && `<li><a href="${params.links.teams}">Open in Teams</a></li>`,
  ].filter(Boolean).join('');
  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;max-width:560px">
      <h2 style="color:#9A7545;margin-bottom:4px">Request fully approved</h2>
      <p style="margin-top:0">
        <strong>${params.title}</strong>${params.referenceCode ? ` (${params.referenceCode})` : ''}
        has completed its review. The signed approval document is attached as a PDF.
      </p>
      ${linkRows ? `<p>It has also been saved to your Microsoft 365:</p><ul>${linkRows}</ul>` : ''}
      <p style="color:#6b7280;font-size:12px">This is an automated message from The Circle.</p>
    </div>`;
}

/**
 * Push an approved request's archive PDF across the Microsoft 365 ecosystem:
 * Teams channel + SharePoint library (organisation), the requester's OneDrive,
 * and an Outlook email to the requester with the PDF attached and links to
 * the stored copies. Best-effort on every leg — never throws.
 */
export async function syncApprovedPdfToMicrosoft(params: {
  storagePath: string;
  referenceCode?: string | null;
  title?: string | null;
  /** Requester (or current user) — receives the OneDrive copy + email. */
  recipientEmail?: string | null;
}): Promise<MicrosoftSyncResult> {
  const result = EMPTY_RESULT();
  try {
    if (!isDocumentUploadConfigured()) return result;

    const token = await getAppToken();
    if (!token) {
      console.warn('graphDocumentUpload: no Graph app token (check AZURE_* env + admin consent).');
      return result;
    }

    const pdf = await downloadArchivePdf(params.storagePath);
    if (!pdf) return result;

    const base = sanitizeFileName(`${params.referenceCode ? params.referenceCode + ' - ' : ''}${params.title || 'Approved Request'}`);
    const fileName = base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;

    const teamsUrl = await uploadToTeams(token, fileName, pdf);
    if (teamsUrl !== null) { result.teams = true; if (teamsUrl) result.links.teams = teamsUrl; }

    const spUrl = await uploadToSharePoint(token, fileName, pdf);
    if (spUrl !== null) { result.sharepoint = true; if (spUrl) result.links.sharepoint = spUrl; }

    if (params.recipientEmail && process.env.GRAPH_ONEDRIVE_ENABLED === 'true') {
      const odUrl = await uploadToUserOneDrive(token, params.recipientEmail, fileName, pdf);
      if (odUrl !== null) { result.onedrive = true; if (odUrl) result.links.onedrive = odUrl; }
    }

    if (params.recipientEmail && process.env.GRAPH_MAIL_SENDER) {
      const mail = await sendAppGraphMail({
        to: params.recipientEmail,
        subject: `Approved: ${params.title || 'Your request'}${params.referenceCode ? ` (${params.referenceCode})` : ''}`,
        html: approvalEmailHtml({ title: params.title || 'Your request', referenceCode: params.referenceCode, links: result.links }),
        attachments: [{ name: fileName, contentType: 'application/pdf', content: pdf }],
      });
      result.email = mail.success;
    }

    return result;
  } catch (e) {
    console.error('graphDocumentUpload: unexpected error:', e);
    return result;
  }
}

/**
 * Back-compat wrapper (Teams + SharePoint only) used by older call sites.
 */
export async function uploadApprovedPdfToMicrosoft(params: {
  storagePath: string;
  referenceCode?: string | null;
  title?: string | null;
}): Promise<{ teams: boolean; sharepoint: boolean }> {
  const res = await syncApprovedPdfToMicrosoft(params);
  return { teams: res.teams, sharepoint: res.sharepoint };
}
