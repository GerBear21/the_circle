import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const { id } = req.query;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    // Fetch the request with all related data
    const { data: request, error } = await supabaseAdmin
      .from('requests')
      .select(`
        id,
        title,
        description,
        status,
        metadata,
        created_at,
        updated_at,
        creator:app_users!requests_creator_id_fkey (
          id,
          display_name,
          email,
          department:departments (
            id,
            name
          )
        ),
        request_steps (
          id,
          step_index,
          step_type,
          approver_role,
          status,
          due_at,
          created_at,
          approver:app_users!request_steps_approver_user_id_fkey (
            id,
            display_name,
            email
          ),
          approvals (
            id,
            decision,
            comment,
            signed_at,
            approver:app_users!approvals_approver_id_fkey (
              id,
              display_name,
              email
            )
          )
        )
      `)
      .eq('id', id)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Request not found' });
      }
      throw error;
    }

    // Sort request_steps by step_index
    if (request.request_steps) {
      request.request_steps.sort((a: any, b: any) => a.step_index - b.step_index);
    }

    // Generate HTML for PDF
    const html = generatePdfHtml(request);

    // Return HTML that can be printed/saved as PDF
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="request-${id}.html"`);
    return res.status(200).send(html);
  } catch (error: any) {
    console.error('PDF generation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate PDF' });
  }
}

function generatePdfHtml(request: any): string {
  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    in_review: 'In Review',
    approved: 'Approved',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
    draft: 'Draft',
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFieldValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getFieldLabel = (key: string): string => {
    const labels: Record<string, string> = {
      irr: 'Internal Rate of Return (IRR)',
      npv: 'Net Present Value (NPV)',
      unit: 'Business Unit',
      amount: 'Amount',
      endDate: 'End Date',
      category: 'Category',
      currency: 'Currency',
      requester: 'Requester',
      startDate: 'Start Date',
      budgetType: 'Budget Type',
      department: 'Department',
      description: 'Description',
      projectName: 'Project Name',
      fundingSource: 'Funding Source',
      justification: 'Justification',
      paybackPeriod: 'Payback Period',
      type: 'Request Type',
      priority: 'Priority',
    };
    return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
  };

  // Get form data from metadata
  const getFormData = (metadata: any): Record<string, any> => {
    if (!metadata) return {};
    const formTypes = ['capex', 'leave', 'travel', 'expense', 'approval'];
    for (const formType of formTypes) {
      if (metadata[formType] && typeof metadata[formType] === 'object') {
        return metadata[formType];
      }
    }
    return metadata;
  };

  const formData = getFormData(request.metadata);
  const excludedFields = ['approvers', 'documents', 'type', 'category'];

  // Build metadata fields HTML
  let metadataHtml = '';
  Object.entries(formData).forEach(([key, value]) => {
    if (!excludedFields.includes(key) && value !== null && value !== undefined && typeof value !== 'object') {
      metadataHtml += `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500; color: #6b7280; width: 200px;">${getFieldLabel(key)}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${formatFieldValue(key, value)}</td>
        </tr>
      `;
    }
  });

  // Build approval steps HTML
  let stepsHtml = '';
  if (request.request_steps && request.request_steps.length > 0) {
    request.request_steps.forEach((step: any, index: number) => {
      const stepStatus = step.status === 'approved' ? '✓ Approved' : 
                        step.status === 'rejected' ? '✗ Rejected' : 
                        '○ Pending';
      const statusColor = step.status === 'approved' ? '#059669' : 
                         step.status === 'rejected' ? '#dc2626' : 
                         '#6b7280';
      const approval = step.approvals?.[0];
      
      stepsHtml += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${index + 1}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${step.approver_role || `Step ${index + 1}`}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${step.approver?.display_name || '—'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: ${statusColor}; font-weight: 500;">${stepStatus}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${approval?.signed_at ? formatDate(approval.signed_at) : '—'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-style: italic; color: #6b7280;">${approval?.comment || '—'}</td>
        </tr>
      `;
    });
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Request - ${request.title}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #111827;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #fff;
    }
    .header {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 8px 0;
    }
    .ref-number {
      font-size: 14px;
      color: #6b7280;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      background: ${request.status === 'approved' ? '#d1fae5' : request.status === 'rejected' ? '#fee2e2' : '#fef3c7'};
      color: ${request.status === 'approved' ? '#059669' : request.status === 'rejected' ? '#dc2626' : '#d97706'};
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e5e7eb;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .info-item {
      padding: 12px;
      background: #f9fafb;
      border-radius: 8px;
    }
    .info-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .info-value {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
      margin-top: 4px;
    }
    .description {
      padding: 16px;
      background: #f9fafb;
      border-radius: 8px;
      white-space: pre-wrap;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 20px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    }
    .print-btn:hover {
      background: #1d4ed8;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
  
  <div class="header">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 class="title">${request.title}</h1>
        <div class="ref-number">Reference: REQ-${request.id.substring(0, 8).toUpperCase()}</div>
      </div>
      <span class="status-badge">${statusLabels[request.status] || request.status}</span>
    </div>
  </div>

  <div class="section">
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Requester</div>
        <div class="info-value">${request.creator?.display_name || 'Unknown'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Department</div>
        <div class="info-value">${request.creator?.department?.name || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Created</div>
        <div class="info-value">${formatDate(request.created_at)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Last Updated</div>
        <div class="info-value">${formatDate(request.updated_at)}</div>
      </div>
    </div>
  </div>

  ${request.description ? `
  <div class="section">
    <h2 class="section-title">Description</h2>
    <div class="description">${request.description}</div>
  </div>
  ` : ''}

  ${metadataHtml ? `
  <div class="section">
    <h2 class="section-title">Request Details</h2>
    <table>
      ${metadataHtml}
    </table>
  </div>
  ` : ''}

  ${stepsHtml ? `
  <div class="section">
    <h2 class="section-title">Approval Workflow</h2>
    <table>
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Step</th>
          <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Role</th>
          <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Approver</th>
          <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Status</th>
          <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Date</th>
          <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Comment</th>
        </tr>
      </thead>
      <tbody>
        ${stepsHtml}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    Generated on ${new Date().toLocaleString()} • The Circle Approval System
  </div>
</body>
</html>
  `;
}
