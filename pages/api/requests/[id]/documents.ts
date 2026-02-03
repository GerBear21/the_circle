import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import formidable from 'formidable';
import * as fs from 'fs';
import * as path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

const STORAGE_BUCKET = 'quotations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;
    const { id: requestId } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    // Verify the request exists and belongs to the organization
    const { data: request, error: requestError } = await supabaseAdmin
      .from('requests')
      .select(`
        id, 
        creator_id,
        metadata,
        request_steps (
          id,
          approver_user_id,
          status
        )
      `)
      .eq('id', requestId)
      .eq('organization_id', organizationId)
      .single();

    if (requestError || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // SEQUENTIAL APPROVAL VISIBILITY CHECK
    const isCreator = request.creator_id === userId;
    
    const watcherIds = request.metadata?.watchers || [];
    const isWatcher = Array.isArray(watcherIds) && watcherIds.some((w: any) => 
      typeof w === 'string' ? w === userId : w?.id === userId
    );
    
    const userStep = request.request_steps?.find(
      (step: any) => step.approver_user_id === userId
    );
    const canApproverView = userStep && userStep.status !== 'waiting';
    
    if (!isCreator && !isWatcher && !canApproverView) {
      if (userStep && userStep.status === 'waiting') {
        return res.status(403).json({ 
          error: 'This request is not yet ready for your review.',
          code: 'APPROVAL_NOT_YOUR_TURN'
        });
      }
      return res.status(403).json({ error: 'You do not have permission to access this request' });
    }

    if (req.method === 'GET') {
      // Get all documents for this request
      const { data: documents, error } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        return res.status(200).json({ documents: [] });
      }

      // Generate signed URLs for each document
      const documentsWithUrls = await Promise.all(
        (documents || []).map(async (doc) => {
          try {
            const { data: signedUrl } = await supabaseAdmin.storage
              .from(STORAGE_BUCKET)
              .createSignedUrl(doc.storage_path, 3600); // 1 hour expiry

            return {
              ...doc,
              download_url: signedUrl?.signedUrl || null,
            };
          } catch (e) {
            return { ...doc, download_url: null };
          }
        })
      );

      return res.status(200).json({ documents: documentsWithUrls });
    }

    if (req.method === 'POST') {
      // Parse the multipart form data
      const form = formidable({
        maxFileSize: 10 * 1024 * 1024, // 10MB limit
        keepExtensions: true,
      });

      const [fields, files] = await form.parse(req);
      const file = files.file?.[0];

      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Read the file
      const fileBuffer = fs.readFileSync(file.filepath);
      const originalFilename = file.originalFilename || 'document';
      const mimeType = file.mimetype || 'application/octet-stream';
      const fileSize = file.size;

      // Generate a unique storage path
      const fileExtension = path.extname(originalFilename);
      const storagePath = `${organizationId}/${requestId}/${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return res.status(500).json({ error: `Failed to upload file: ${uploadError.message}` });
      }

      // Create document record in database
      const { data: document, error: dbError } = await supabaseAdmin
        .from('documents')
        .insert({
          request_id: requestId,
          filename: originalFilename,
          storage_path: storagePath,
          file_size: fileSize,
          mime_type: mimeType,
        })
        .select()
        .single();

      if (dbError) {
        // Try to clean up the uploaded file
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
        console.error('Database insert error:', dbError);
        return res.status(500).json({ error: `Failed to save document record: ${dbError.message}` });
      }

      // Clean up temp file
      try {
        fs.unlinkSync(file.filepath);
      } catch (e) {
        // Ignore cleanup errors
      }

      // Get signed URL for the new document
      const { data: signedUrl } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 3600);

      return res.status(201).json({
        document: {
          ...document,
          download_url: signedUrl?.signedUrl || null,
        },
      });
    }

    if (req.method === 'DELETE') {
      const { documentId } = req.query;

      if (!documentId || typeof documentId !== 'string') {
        return res.status(400).json({ error: 'Document ID is required' });
      }

      // Get the document
      const { data: document, error: fetchError } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('request_id', requestId)
        .single();

      if (fetchError || !document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Delete from storage
      await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([document.storage_path]);

      // Delete from database
      const { error: deleteError } = await supabaseAdmin
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) throw deleteError;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Documents API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
