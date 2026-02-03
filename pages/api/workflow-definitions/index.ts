import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

    if (req.method === 'GET') {
      const { category, active_only } = req.query;
      
      let query = supabaseAdmin
        .from('workflow_definitions')
        .select(`
          id,
          name,
          description,
          category,
          form_schema,
          steps,
          settings,
          is_active,
          version,
          created_at,
          updated_at,
          creator:app_users!workflow_definitions_created_by_fkey (
            id,
            display_name,
            email
          )
        `)
        .eq('organization_id', organizationId)
        .order('name');

      if (active_only === 'true') {
        query = query.eq('is_active', true);
      }

      if (category) {
        query = query.eq('category', category);
      }

      const { data: definitions, error } = await query;

      if (error) throw error;

      return res.status(200).json({ definitions: definitions || [] });
    }

    if (req.method === 'POST') {
      const { name, description, category, formSchema, steps, settings } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Workflow name is required' });
      }

      if (!steps || steps.length === 0) {
        return res.status(400).json({ error: 'At least one workflow step is required' });
      }

      // Validate steps have required fields
      for (const step of steps) {
        if (!step.name || !step.type || !step.approverType) {
          return res.status(400).json({ 
            error: 'Each step must have name, type, and approverType' 
          });
        }
      }

      const defaultSettings = {
        allowParallelApprovals: false,
        requireAllParallel: true,
        allowSkipSteps: false,
        allowReassignment: true,
        expirationDays: 30,
        onExpiration: 'escalate',
        notifyRequesterOnEachStep: true,
        allowWithdraw: true,
        requireAttachments: false,
      };

      const { data, error } = await supabaseAdmin
        .from('workflow_definitions')
        .insert({
          organization_id: organizationId,
          created_by: userId,
          name,
          description: description || null,
          category: category || null,
          form_schema: formSchema || [],
          steps: steps.map((step: any, index: number) => ({
            ...step,
            id: step.id || `step_${index + 1}`,
            order: index + 1,
          })),
          settings: { ...defaultSettings, ...settings },
          is_active: true,
          version: 1,
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ definition: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Workflow definitions API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}
