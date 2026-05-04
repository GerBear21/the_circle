import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAnyPermission } from '../../../../lib/rbac';
import formidable from 'formidable';
import * as fs from 'fs';
import * as path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

const STORAGE_BUCKET = 'capex-budgets';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = session.user as any;
    const organizationId = user.org_id;
    const userId = user.id;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (req.method !== 'POST') {
      // Explicitly reject PATCH and DELETE per spec — budgets are non-editable
      return res.status(405).json({ error: 'Method not allowed. Budgets can only be uploaded (POST).' });
    }

    const { allowed } = await requireAnyPermission(userId, ['finance.manage_budget']);
    if (!allowed) {
      return res.status(403).json({ error: 'Only Super Admin can upload the annual CAPEX budget.' });
    }

    const form = formidable({
      maxFileSize: 15 * 1024 * 1024,
      keepExtensions: true,
    });
    const [fields, files] = await form.parse(req);

    const file = files.file?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const rawYear = Array.isArray(fields.financial_year) ? fields.financial_year[0] : fields.financial_year;
    const financialYear = Number(rawYear);
    if (!Number.isFinite(financialYear) || financialYear < 2000 || financialYear > 2100) {
      return res.status(400).json({ error: 'Valid financial_year is required' });
    }

    const rawTotal = Array.isArray(fields.total_budget) ? fields.total_budget[0] : fields.total_budget;
    let totalBudget: number | null = null;
    if (rawTotal !== undefined && rawTotal !== null && rawTotal !== '') {
      const parsed = Number(rawTotal);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).json({ error: 'total_budget must be a non-negative number' });
      }
      totalBudget = parsed;
    }

    const { data: existing } = await supabaseAdmin
      .from('capex_budgets')
      .select('id, is_placeholder, budget_document_path')
      .eq('organization_id', organizationId)
      .eq('financial_year', financialYear)
      .maybeSingle();

    if (existing && !existing.is_placeholder) {
      return res.status(409).json({
        error: `A real budget for financial year ${financialYear} has already been uploaded. Budgets are non-editable.`,
      });
    }

    const mimeType = file.mimetype || 'application/pdf';
    if (mimeType !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF documents are accepted for the CAPEX budget.' });
    }

    const fileBuffer = fs.readFileSync(file.filepath);
    const originalFilename = file.originalFilename || `capex-budget-${financialYear}.pdf`;
    const ext = path.extname(originalFilename) || '.pdf';
    const storagePath = `${organizationId}/${financialYear}/${Date.now()}${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });
    if (uploadError) {
      console.error('capex budget upload error:', uploadError);
      return res.status(500).json({ error: `Failed to upload file: ${uploadError.message}` });
    }

    try {
      fs.unlinkSync(file.filepath);
    } catch (_) {
      // ignore cleanup failure
    }

    const payload = {
      organization_id: organizationId,
      financial_year: financialYear,
      budget_document_path: storagePath,
      budget_document_name: originalFilename,
      total_budget: totalBudget,
      is_placeholder: false,
      created_by: userId,
    };

    let saved;
    if (existing && existing.is_placeholder) {
      const { data, error } = await supabaseAdmin
        .from('capex_budgets')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) {
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
        throw error;
      }
      saved = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('capex_budgets')
        .insert(payload)
        .select()
        .single();
      if (error) {
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
        throw error;
      }
      saved = data;
    }

    return res.status(201).json({ budget: saved });
  } catch (error: any) {
    console.error('capex budget upload error:', error);
    return res.status(500).json({ error: error.message || 'Failed to upload budget' });
  }
}
