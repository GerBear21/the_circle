import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requirePermission, PERMISSIONS } from '@/lib/rbac';
import formidable from 'formidable';
import * as fs from 'fs';
import * as path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Reuse the existing request-documents bucket; delegation files live under a
// dedicated org/delegations/<id>/ prefix.
const STORAGE_BUCKET = 'quotations';
const ALLOWED_MIME = /^image\//;

/** Allow either the system-config admin or a user-access manager. */
async function canManageDelegations(userId: string): Promise<boolean> {
  const a = await requirePermission(userId, PERMISSIONS.ADMIN_SYSTEM_CONFIG);
  if (a.allowed) return true;
  const b = await requirePermission(userId, PERMISSIONS.USERS_MANAGE_ACCESS);
  return b.allowed;
}

interface DelegationDocument {
  name: string;
  storage_path: string;
  size: number;
  mime_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = session.user.id;
  const orgId = (session.user as any).org_id;
  if (!orgId) return res.status(400).json({ error: 'No organization found' });

  if (!(await canManageDelegations(userId))) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { id } = req.query;
  if (typeof id !== 'string') return res.status(400).json({ error: 'Invalid delegation id' });

  // The delegation must exist and belong to the caller's organization.
  const { data: delegation, error: fetchError } = await supabaseAdmin
    .from('approval_delegations')
    .select('id, organization_id, documents')
    .eq('id', id)
    .single();

  if (fetchError || !delegation) {
    return res.status(404).json({ error: 'Delegation not found' });
  }
  if (delegation.organization_id !== orgId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const existingDocs: DelegationDocument[] = Array.isArray(delegation.documents) ? delegation.documents : [];

  // ---- GET: list documents with fresh signed URLs --------------------------
  if (req.method === 'GET') {
    const withUrls = await Promise.all(
      existingDocs.map(async (doc) => {
        try {
          const { data: signed } = await supabaseAdmin.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(doc.storage_path, 3600);
          return { ...doc, download_url: signed?.signedUrl || null };
        } catch {
          return { ...doc, download_url: null };
        }
      })
    );
    return res.status(200).json({ documents: withUrls });
  }

  // ---- POST: upload an image -----------------------------------------------
  if (req.method === 'POST') {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024, keepExtensions: true });
    const [, files] = await form.parse(req);
    const file = files.file?.[0];

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const mimeType = file.mimetype || 'application/octet-stream';
    if (!ALLOWED_MIME.test(mimeType)) {
      try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }
      return res.status(400).json({ error: 'Only image files are allowed' });
    }

    const originalFilename = file.originalFilename || 'image';
    const fileBuffer = fs.readFileSync(file.filepath);
    const fileExtension = path.extname(originalFilename);
    const storagePath = `${orgId}/delegations/${id}/${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error('Delegation document upload error:', uploadError);
      return res.status(500).json({ error: `Failed to upload file: ${uploadError.message}` });
    }

    const newDoc: DelegationDocument = {
      name: originalFilename,
      storage_path: storagePath,
      size: file.size,
      mime_type: mimeType,
      uploaded_by: userId,
      uploaded_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from('approval_delegations')
      .update({ documents: [...existingDocs, newDoc] })
      .eq('id', id);

    if (updateError) {
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
      console.error('Delegation document metadata save failed:', updateError);
      return res.status(500).json({ error: 'Failed to save document record' });
    }

    try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }

    const { data: signed } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    return res.status(201).json({ document: { ...newDoc, download_url: signed?.signedUrl || null } });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
