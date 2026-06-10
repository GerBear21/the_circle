/**
 * Upload approved request PDFs to Microsoft 365 — Teams channel + SharePoint —
 * via Microsoft Graph using the app's own identity (client-credentials). No
 * third-party services.
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
 *
 * Required Graph **application** permissions (admin consent): Sites.ReadWrite.All
 * (covers Teams channel files, which live in SharePoint) and, to resolve the
 * channel folder, ChannelSettings.Read.All or Group.Read.All.
 */

import { supabaseAdmin } from './supabaseAdmin';
import { getAppToken } from './graphAppMail';

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

async function putToDrive(token: string, driveId: string, parentItemId: string, fileName: string, pdf: Buffer): Promise<boolean> {
  // Simple upload (fine for typical < 4 MB form PDFs). Path-addressed by
  // parent item id so it lands directly in the channel/library folder.
  const url = `${GRAPH}/drives/${driveId}/items/${parentItemId}:/${encodeURIComponent(fileName)}:/content`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' },
    body: pdf,
  });
  if (!resp.ok) {
    console.error('graphDocumentUpload: drive PUT failed:', resp.status, await resp.text().catch(() => ''));
    return false;
  }
  return true;
}

async function uploadToTeams(token: string, fileName: string, pdf: Buffer): Promise<boolean> {
  const teamId = process.env.GRAPH_TEAM_ID;
  const channelId = process.env.GRAPH_CHANNEL_ID;
  if (!teamId || !channelId) return false;
  try {
    // The channel's Files tab maps to a SharePoint folder (a driveItem).
    const folderResp = await fetch(`${GRAPH}/teams/${teamId}/channels/${channelId}/filesFolder`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!folderResp.ok) {
      console.error('graphDocumentUpload: filesFolder lookup failed:', folderResp.status, await folderResp.text().catch(() => ''));
      return false;
    }
    const folder: any = await folderResp.json();
    const driveId = folder?.parentReference?.driveId;
    const itemId = folder?.id;
    if (!driveId || !itemId) {
      console.error('graphDocumentUpload: channel filesFolder missing drive/item id');
      return false;
    }
    return await putToDrive(token, driveId, itemId, fileName, pdf);
  } catch (e) {
    console.error('graphDocumentUpload: Teams upload threw:', e);
    return false;
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

async function uploadToSharePoint(token: string, fileName: string, pdf: Buffer): Promise<boolean> {
  const driveId = await resolveSharePointDriveId(token);
  if (!driveId) return false;
  const folder = (process.env.GRAPH_SHAREPOINT_FOLDER || '').replace(/^\/+|\/+$/g, '');
  const path = folder ? `${folder}/${fileName}` : fileName;
  const url = `${GRAPH}/drives/${driveId}/root:/${path.split('/').map(encodeURIComponent).join('/')}:/content`;
  try {
    const resp = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' },
      body: pdf,
    });
    if (!resp.ok) {
      console.error('graphDocumentUpload: SharePoint PUT failed:', resp.status, await resp.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.error('graphDocumentUpload: SharePoint upload threw:', e);
    return false;
  }
}

export function isDocumentUploadConfigured(): boolean {
  return !!(
    (process.env.GRAPH_TEAM_ID && process.env.GRAPH_CHANNEL_ID) ||
    process.env.GRAPH_SHAREPOINT_DRIVE_ID ||
    process.env.GRAPH_SHAREPOINT_SITE_ID
  );
}

/**
 * Best-effort: push an approved request's archive PDF to the configured Teams
 * channel and SharePoint library. Never throws.
 */
export async function uploadApprovedPdfToMicrosoft(params: {
  storagePath: string;
  referenceCode?: string | null;
  title?: string | null;
}): Promise<{ teams: boolean; sharepoint: boolean }> {
  const result = { teams: false, sharepoint: false };
  try {
    if (!isDocumentUploadConfigured()) return result;

    const token = await getAppToken();
    if (!token) {
      console.warn('graphDocumentUpload: no Graph app token (check AZURE_* env + Sites.ReadWrite.All consent).');
      return result;
    }

    const pdf = await downloadArchivePdf(params.storagePath);
    if (!pdf) return result;

    const base = sanitizeFileName(`${params.referenceCode ? params.referenceCode + ' - ' : ''}${params.title || 'Approved Request'}`);
    const fileName = base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;

    result.teams = await uploadToTeams(token, fileName, pdf);
    result.sharepoint = await uploadToSharePoint(token, fileName, pdf);
    return result;
  } catch (e) {
    console.error('graphDocumentUpload: unexpected error:', e);
    return result;
  }
}
