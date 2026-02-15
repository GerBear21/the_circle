import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

// This API generates and stores a PDF archive for a fully approved request
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = session.user as any;
    const organizationId = user.org_id;
    const { requestId, force } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID not found' });
    }

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    // Generate and store the archive
    const result = await generateAndStoreArchive(requestId, organizationId, user.id, !!force);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({ 
      success: true, 
      archive: result.archive 
    });
  } catch (error: any) {
    console.error('Archive generation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate archive' });
  }
}

export async function generateAndStoreArchive(
  requestId: string, 
  organizationId: string,
  archivedBy?: string,
  force: boolean = false
): Promise<{ success: boolean; archive?: any; error?: string }> {
  try {
    // Check if archive already exists
    const { data: existingArchives } = await supabaseAdmin
      .from('archived_documents')
      .select('id, storage_path')
      .eq('request_id', requestId)
      .limit(1);

    if (existingArchives && existingArchives.length > 0) {
      if (!force) {
        return { success: true, archive: existingArchives[0] };
      }
      // Force regeneration: delete old archive record and storage file
      for (const old of existingArchives) {
        if (old.storage_path) {
          await supabaseAdmin.storage.from('archives').remove([old.storage_path]);
        }
        await supabaseAdmin.from('archived_documents').delete().eq('id', old.id);
      }
    }

    // Fetch the complete request data
    const { data: requestData, error: requestError } = await supabaseAdmin
      .from('requests')
      .select(`
        id,
        title,
        description,
        status,
        metadata,
        created_at,
        updated_at,
        creator_id,
        organization_id,
        creator:app_users!requests_creator_id_fkey (
          id,
          display_name,
          email,
          department_id,
          job_title
        ),
        request_steps (
          id,
          step_index,
          step_type,
          approver_role,
          approver_user_id,
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
            approver_id,
            approver:app_users!approvals_approver_id_fkey (
              id,
              display_name,
              email
            )
          )
        ),
        documents (
          id,
          filename,
          storage_path,
          file_size,
          mime_type,
          created_at
        )
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !requestData) {
      console.error('Request fetch error:', requestError);
      return { success: false, error: `Request not found: ${requestError?.message || 'no data returned'}` };
    }

    // Type cast for easier access
    const request = requestData as any;

    // Verify request is fully approved
    if (request.status !== 'approved') {
      return { success: false, error: 'Request is not fully approved' };
    }

    // Sort steps by index
    if (request.request_steps) {
      request.request_steps.sort((a: any, b: any) => a.step_index - b.step_index);
    }

    // Get the latest approval timestamp
    let latestApprovalTimeValue: Date | null = null;
    request.request_steps?.forEach((step: any) => {
      step.approvals?.forEach((approval: any) => {
        const approvalDate = new Date(approval.signed_at);
        if (!latestApprovalTimeValue || approvalDate > latestApprovalTimeValue) {
          latestApprovalTimeValue = approvalDate;
        }
      });
    });
    const latestApprovalTime = latestApprovalTimeValue;

    // Extract creator info (handle both single object and array from Supabase)
    const creator = Array.isArray(request.creator) ? request.creator[0] : request.creator;
    const creatorDepartment = creator?.department ? (Array.isArray(creator.department) ? creator.department[0] : creator.department) : null;

    // Resolve signature URLs from storage for each approval
    for (const step of (request.request_steps || [])) {
      for (const approval of (step.approvals || [])) {
        if (approval.approver_id) {
          const { data } = supabaseAdmin.storage.from('signatures').getPublicUrl(`${approval.approver_id}.png`);
          if (data?.publicUrl) {
            try {
              const checkRes = await fetch(data.publicUrl, { method: 'HEAD' });
              if (checkRes.ok) {
                approval.signature_url = data.publicUrl;
              }
            } catch {
              // Signature file doesn't exist, leave as undefined
            }
          }
        }
      }
    }

    // Get form data for amount/currency
    const formData = getFormData(request.metadata);
    const amount = formData.amount ? parseFloat(formData.amount) : null;
    const currency = formData.currency || '$';

    // Generate the PDF using PDFKit
    const pdfBuffer = await generatePdfBuffer(request, latestApprovalTime, formData);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const refNumber = `REQ-${request.id.substring(0, 8).toUpperCase()}`;
    const filename = `${refNumber}_${timestamp}.pdf`;
    const storagePath = `archives/${organizationId}/${requestId}/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('archives')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { success: false, error: `Failed to upload archive: ${uploadError.message}` };
    }

    // Prepare attached documents info
    const attachedDocs = (request.documents || []).map((doc: any) => ({
      id: doc.id,
      filename: doc.filename,
      storage_path: doc.storage_path,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
    }));

    // Create archive record
    const { data: archive, error: dbError } = await supabaseAdmin
      .from('archived_documents')
      .insert({
        request_id: requestId,
        organization_id: request.organization_id,
        filename,
        storage_path: storagePath,
        file_size: pdfBuffer.length,
        mime_type: 'application/pdf',
        archived_by: archivedBy || null,
        request_title: request.title,
        request_reference: refNumber,
        requester_name: creator?.display_name || 'Unknown',
        requester_department: creatorDepartment?.name || null,
        total_amount: amount,
        currency,
        approval_completed_at: latestApprovalTime ? (latestApprovalTime as Date).toISOString() : new Date().toISOString(),
        approver_count: request.request_steps?.length || 0,
        attached_documents: attachedDocs,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      return { success: false, error: `Failed to create archive record: ${dbError.message}` };
    }

    return { success: true, archive };
  } catch (error: any) {
    console.error('Archive generation error:', error);
    return { success: false, error: error.message || 'Failed to generate archive' };
  }
}

function getFormData(metadata: any): Record<string, any> {
  if (!metadata) return {};
  const formTypes = ['capex', 'leave', 'travel', 'expense', 'approval', 'comp'];
  for (const formType of formTypes) {
    if (metadata[formType] && typeof metadata[formType] === 'object') {
      return metadata[formType];
    }
  }
  return metadata;
}

function getFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    irr: 'Internal Rate of Return (IRR)',
    npv: 'Net Present Value (NPV)',
    unit: 'Business Unit',
    amount: 'Project Cost',
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
    justification: 'Business Justification',
    paybackPeriod: 'Payback Period',
    type: 'Request Type',
    priority: 'Priority / Urgency',
    evaluation: 'Evaluation',
    dateOfIntendedTravel: 'Date of Intended Travel',
    purposeOfTravel: 'Purpose of Travel',
    accompanyingAssociates: 'Accompanying Associates',
    travelMode: 'Travel Mode',
    acceptConditions: 'Conditions Accepted',
    grandTotal: 'Grand Total',
    guestNames: 'Guest Name(s)',
    isExternalGuest: 'External Guest',
    allocationType: 'Allocation Type',
    percentageDiscount: 'Percentage Discount',
    reason: 'Reason',
    processTravelDocument: 'Process Travel Document',
    hotelUnit: 'Hotel Unit',
    telBookingMade: 'Tel/Booking Already Made',
    arrivalDate: 'Arrival Date',
    departureDate: 'Departure Date',
    numberOfNights: 'Number of Nights',
    numberOfRooms: 'Number of Rooms',
    accommodationType: 'Accommodation Type',
    specialArrangements: 'Special Arrangements',
  };
  return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
}

function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

// ── PDF helper: draw a section heading ──
function drawSectionHeading(doc: any, text: string, yPos: number, pageWidth: number): number {
  if (yPos > 720) { doc.addPage(); yPos = 50; }
  doc.fontSize(11).fillColor('#374151').font('Helvetica-Bold').text(text.toUpperCase(), 50, yPos, { width: pageWidth });
  doc.font('Helvetica');
  yPos += 16;
  doc.moveTo(50, yPos).lineTo(50 + pageWidth, yPos).strokeColor('#d1d5db').lineWidth(0.5).stroke();
  yPos += 8;
  return yPos;
}

// ── PDF helper: draw a key-value row ──
function drawFieldRow(doc: any, label: string, value: string, yPos: number, pageWidth: number, labelWidth: number = 170): number {
  if (yPos > 750) { doc.addPage(); yPos = 50; }
  doc.rect(50, yPos, labelWidth, 22).fillColor('#f3f4f6').fill();
  doc.fontSize(8).fillColor('#6b7280').font('Helvetica-Bold').text(label.toUpperCase(), 55, yPos + 7, { width: labelWidth - 10 });
  doc.font('Helvetica').fontSize(9).fillColor('#111827').text(value || 'N/A', 50 + labelWidth + 8, yPos + 7, { width: pageWidth - labelWidth - 8 });
  return yPos + 25;
}

// ── PDF helper: draw a table ──
function drawTable(doc: any, headers: string[], rows: string[][], yPos: number, pageWidth: number, colWidths?: number[]): number {
  const numCols = headers.length;
  const defaultColWidth = pageWidth / numCols;
  const widths = colWidths || headers.map(() => defaultColWidth);
  const rowHeight = 20;

  // Header row
  if (yPos > 720) { doc.addPage(); yPos = 50; }
  let xPos = 50;
  headers.forEach((header, i) => {
    doc.rect(xPos, yPos, widths[i], rowHeight).fillColor('#e5e7eb').fill();
    doc.rect(xPos, yPos, widths[i], rowHeight).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    doc.fontSize(7).fillColor('#374151').font('Helvetica-Bold').text(header.toUpperCase(), xPos + 4, yPos + 6, { width: widths[i] - 8 });
    xPos += widths[i];
  });
  doc.font('Helvetica');
  yPos += rowHeight;

  // Data rows
  rows.forEach((row) => {
    if (yPos > 750) { doc.addPage(); yPos = 50; }
    xPos = 50;
    row.forEach((cell, i) => {
      doc.rect(xPos, yPos, widths[i], rowHeight).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor('#111827').text(cell || '', xPos + 4, yPos + 6, { width: widths[i] - 8 });
      xPos += widths[i];
    });
    yPos += rowHeight;
  });

  return yPos + 5;
}

// ── PDF helper: draw a checkbox field ──
function drawCheckboxField(doc: any, label: string, checked: boolean, yPos: number, pageWidth: number): number {
  if (yPos > 750) { doc.addPage(); yPos = 50; }
  const boxSize = 10;
  doc.rect(55, yPos, boxSize, boxSize).strokeColor('#6b7280').lineWidth(1).stroke();
  if (checked) {
    doc.fontSize(9).fillColor('#22c55e').text('✓', 56.5, yPos + 0.5);
  }
  doc.fontSize(9).fillColor('#111827').text(label, 70, yPos + 1, { width: pageWidth - 30 });
  return yPos + 18;
}

// ── Detect form type from metadata ──
function detectFormType(metadata: any): string {
  if (!metadata) return 'generic';
  if (metadata.type === 'travel_authorization' || metadata.itinerary) return 'travel_authorization';
  if (metadata.type === 'capex' || metadata.capex || metadata.projectName) return 'capex';
  if (metadata.type === 'external_hotel_booking' || metadata.hotelBooking?.hotelUnit) return 'external_hotel_booking';
  if (metadata.type === 'hotel_booking' || metadata.selectedBusinessUnits || metadata.guestNames) return 'hotel_booking';
  return 'generic';
}

// ── Render Travel Authorization form data ──
function renderTravelAuth(doc: any, formData: Record<string, any>, yPos: number, pageWidth: number, creator: any, creatorDept: any): number {
  // Requestor Information
  yPos = drawSectionHeading(doc, 'Requestor Information', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Name', creator?.display_name || 'N/A', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Department', creatorDept?.name || 'N/A', yPos, pageWidth);
  yPos += 5;

  // Travel Details
  yPos = drawSectionHeading(doc, 'Travel Details', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Date of Intended Travel', formatDate(formData.dateOfIntendedTravel), yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Purpose of Travel', formData.purposeOfTravel || 'N/A', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Accompanying Associates', formData.accompanyingAssociates || 'None', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Travel Mode', formData.travelMode || 'N/A', yPos, pageWidth);
  yPos += 5;

  // Conditions of Travel
  yPos = drawSectionHeading(doc, 'Conditions of Travel', yPos, pageWidth);
  if (yPos > 720) { doc.addPage(); yPos = 50; }
  doc.fontSize(8).fillColor('#4b5563').text('1. Authorization must be sought using this form at least 7 days prior to departure.', 55, yPos, { width: pageWidth - 10 });
  yPos += 12;
  doc.fontSize(8).fillColor('#4b5563').text('2. Travel expenses must be claimed within 30 days after completion of travel, otherwise the claim shall be void.', 55, yPos, { width: pageWidth - 10 });
  yPos += 12;
  doc.fontSize(8).fillColor('#4b5563').text('3. It is an act of misconduct to travel without authority.', 55, yPos, { width: pageWidth - 10 });
  yPos += 14;
  yPos = drawCheckboxField(doc, 'I have read these conditions and accept them.', !!formData.acceptConditions, yPos, pageWidth);
  yPos += 5;

  // Travel Itinerary Table
  if (formData.itinerary && Array.isArray(formData.itinerary) && formData.itinerary.length > 0) {
    yPos = drawSectionHeading(doc, 'Travel Itinerary', yPos, pageWidth);
    const itinHeaders = ['Date/Time', 'From', 'To', 'KM', 'Justification'];
    const itinWidths = [pageWidth * 0.18, pageWidth * 0.2, pageWidth * 0.2, pageWidth * 0.1, pageWidth * 0.32];
    const itinRows = formData.itinerary
      .filter((row: any) => row.date || row.from || row.to)
      .map((row: any) => [
        row.date ? formatDate(row.date) : '',
        row.from || '',
        row.to || '',
        row.km || '',
        row.justification || '',
      ]);
    if (itinRows.length > 0) {
      yPos = drawTable(doc, itinHeaders, itinRows, yPos, pageWidth, itinWidths);
    }
    yPos += 5;
  }

  // Travel Budget Table
  if (formData.budget && typeof formData.budget === 'object') {
    yPos = drawSectionHeading(doc, 'Travel Budget', yPos, pageWidth);
    const budgetHeaders = ['Expenditure Item', 'Quantity', 'Unit Cost (USD)', 'Total Cost (USD)'];
    const budgetWidths = [pageWidth * 0.4, pageWidth * 0.15, pageWidth * 0.2, pageWidth * 0.25];
    const b = formData.budget;
    const budgetItems: Array<{ label: string; data: any }> = [
      { label: 'Fuel (Litres)', data: b.fuel },
      { label: 'AA Rates (KM)', data: b.aaRates },
      { label: 'Air/Bus Tickets', data: b.airBusTickets },
      { label: 'Conferencing Cost', data: b.conferencingCost },
      { label: 'Tollgates', data: b.tollgates },
      { label: b.other?.description || 'Other', data: b.other },
    ];
    const budgetRows = budgetItems
      .filter(item => item.data)
      .map(item => [
        item.label,
        item.data.quantity || '0',
        item.data.unitCost || '0.00',
        item.data.totalCost || '0.00',
      ]);
    yPos = drawTable(doc, budgetHeaders, budgetRows, yPos, pageWidth, budgetWidths);

    // Grand Total row
    if (yPos > 750) { doc.addPage(); yPos = 50; }
    doc.rect(50, yPos, pageWidth, 22).fillColor('#e5e7eb').fill();
    doc.rect(50, yPos, pageWidth, 22).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    doc.fontSize(9).fillColor('#111827').font('Helvetica-Bold').text('GRAND TOTAL', 54, yPos + 6, { width: pageWidth * 0.75 });
    doc.text(`USD ${formData.grandTotal || '0.00'}`, 54, yPos + 6, { width: pageWidth - 8, align: 'right' });
    doc.font('Helvetica');
    yPos += 30;
  }

  return yPos;
}

// ── Render CAPEX form data ──
function renderCapex(doc: any, formData: Record<string, any>, yPos: number, pageWidth: number, creator: any, creatorDept: any): number {
  // Requestor Information
  yPos = drawSectionHeading(doc, 'Requestor Information', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Requester', formData.requester || creator?.display_name || 'N/A', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Business Unit', formData.unit || 'N/A', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Department', formData.department || creatorDept?.name || 'N/A', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Budget Type', formData.budgetType || 'N/A', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Priority / Urgency', formData.priority || 'N/A', yPos, pageWidth);
  yPos += 5;

  // Project Details
  yPos = drawSectionHeading(doc, 'Project Details', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Project Name', formData.projectName || 'N/A', yPos, pageWidth);
  if (formData.description) {
    yPos = drawFieldRow(doc, 'Detailed Description', formData.description, yPos, pageWidth);
  }
  if (formData.justification) {
    yPos = drawFieldRow(doc, 'Business Justification', formData.justification, yPos, pageWidth);
  }
  if (formData.startDate || formData.endDate) {
    yPos = drawFieldRow(doc, 'Start Date', formatDate(formData.startDate), yPos, pageWidth);
    yPos = drawFieldRow(doc, 'End Date', formatDate(formData.endDate), yPos, pageWidth);
  }
  yPos += 5;

  // Financial Analysis
  yPos = drawSectionHeading(doc, 'Financial Analysis', yPos, pageWidth);
  const currencySymbol = formData.currency === 'ZIG' ? 'ZiG' : 'USD';
  yPos = drawFieldRow(doc, 'Project Cost', formData.amount ? `${currencySymbol} ${formData.amount}` : 'N/A', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Currency', formData.currency || 'USD', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Payback Period', formData.paybackPeriod || 'N/A', yPos, pageWidth);
  if (formData.npv) yPos = drawFieldRow(doc, 'NPV (Net Present Value)', formData.npv, yPos, pageWidth);
  if (formData.irr) yPos = drawFieldRow(doc, 'IRR (Internal Rate of Return)', formData.irr, yPos, pageWidth);
  if (formData.evaluation) yPos = drawFieldRow(doc, 'Evaluation', formData.evaluation, yPos, pageWidth);
  if (formData.fundingSource) yPos = drawFieldRow(doc, 'Funding Source', formData.fundingSource, yPos, pageWidth);
  yPos += 5;

  return yPos;
}

// ── Render Hotel Booking form data ──
function renderHotelBooking(doc: any, formData: Record<string, any>, yPos: number, pageWidth: number, creator: any, creatorDept: any): number {
  yPos = drawSectionHeading(doc, 'Guest Information', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Guest Name(s)', formData.guestNames || 'N/A', yPos, pageWidth);
  yPos = drawCheckboxField(doc, 'External Guest', !!formData.isExternalGuest, yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Allocation Type', (formData.allocationType || '').replace(/_/g, ' '), yPos, pageWidth);
  if (formData.percentageDiscount) yPos = drawFieldRow(doc, 'Percentage Discount', `${formData.percentageDiscount}%`, yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Reason', formData.reason || 'N/A', yPos, pageWidth);
  yPos = drawCheckboxField(doc, 'Process Travel Document', !!formData.processTravelDocument, yPos, pageWidth);
  yPos += 5;

  // Selected Business Units table
  if (formData.selectedBusinessUnits && Array.isArray(formData.selectedBusinessUnits) && formData.selectedBusinessUnits.length > 0) {
    yPos = drawSectionHeading(doc, 'Hotel Reservations', yPos, pageWidth);
    const headers = ['Hotel Unit', 'Arrival', 'Departure', 'Nights', 'Rooms', 'Type'];
    const colWidths = [pageWidth * 0.25, pageWidth * 0.15, pageWidth * 0.15, pageWidth * 0.1, pageWidth * 0.1, pageWidth * 0.25];
    const rows = formData.selectedBusinessUnits.map((bu: any) => [
      bu.name || '',
      bu.arrivalDate ? formatDate(bu.arrivalDate) : '',
      bu.departureDate ? formatDate(bu.departureDate) : '',
      bu.numberOfNights || '',
      bu.numberOfRooms || '',
      (bu.accommodationType || '').replace(/_/g, ' '),
    ]);
    yPos = drawTable(doc, headers, rows, yPos, pageWidth, colWidths);
    yPos += 5;
  }

  // Travel data if processTravelDocument
  if (formData.travelData || formData.processTravelDocument) {
    const td = formData.travelData || formData;
    if (td.itinerary || td.budget) {
      yPos = renderTravelAuth(doc, td, yPos, pageWidth, creator, creatorDept);
    }
  }

  return yPos;
}

// ── Render External Hotel Booking form data ──
function renderExternalHotelBooking(doc: any, formData: Record<string, any>, yPos: number, pageWidth: number): number {
  // The metadata may be nested under hotelBooking
  const data = formData.hotelBooking || formData;

  yPos = drawSectionHeading(doc, 'Hotel Reservation', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Hotel Unit', data.hotelUnit || 'N/A', yPos, pageWidth);
  yPos += 5;

  yPos = drawSectionHeading(doc, 'Guest Information', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Guest Name(s)', data.guestNames || 'N/A', yPos, pageWidth);
  yPos = drawCheckboxField(doc, 'Tel / Booking Already Made', !!data.telBookingMade, yPos, pageWidth);
  yPos += 5;

  yPos = drawSectionHeading(doc, 'Stay Details', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Arrival Date', formatDate(data.arrivalDate), yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Departure Date', formatDate(data.departureDate), yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Number of Nights', data.numberOfNights || 'N/A', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Number of Rooms', data.numberOfRooms || 'N/A', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Accommodation Type', (data.accommodationType || '').replace(/_/g, ' '), yPos, pageWidth);
  yPos += 5;

  yPos = drawSectionHeading(doc, 'Allocation & Discount', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Allocation Type', (data.allocationType || '').replace(/_/g, ' '), yPos, pageWidth);
  if (data.percentageDiscount) yPos = drawFieldRow(doc, 'Percentage Discount', `${data.percentageDiscount}%`, yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Special Arrangements', data.specialArrangements || 'N/A', yPos, pageWidth);
  yPos = drawFieldRow(doc, 'Reason', data.reason || 'N/A', yPos, pageWidth);
  yPos = drawCheckboxField(doc, 'Process Travel Document', !!data.processTravelDocument, yPos, pageWidth);
  yPos += 5;

  return yPos;
}

// ── Render generic form data (fallback for unknown form types) ──
function renderGenericForm(doc: any, formData: Record<string, any>, yPos: number, pageWidth: number): number {
  const excludedFields = ['approvers', 'documents', 'type', 'category', 'watchers', 'useParallelApprovals', 'current_step', 'approverRoles'];

  yPos = drawSectionHeading(doc, 'Request Details', yPos, pageWidth);

  for (const [key, value] of Object.entries(formData)) {
    if (excludedFields.includes(key) || value === null || value === undefined || value === '') continue;

    if (Array.isArray(value)) {
      // Render arrays as tables if they contain objects
      const objectItems = value.filter(v => v && typeof v === 'object');
      if (objectItems.length > 0) {
        const allKeys = [...new Set(objectItems.flatMap(obj => Object.keys(obj)))];
        const headers = allKeys.map(k => getFieldLabel(k));
        const colWidths = allKeys.map(() => pageWidth / allKeys.length);
        const rows = objectItems.map(obj => allKeys.map(k => String(obj[k] ?? '')));
        if (yPos > 650) { doc.addPage(); yPos = 50; }
        doc.fontSize(9).fillColor('#374151').font('Helvetica-Bold').text(getFieldLabel(key), 50, yPos);
        doc.font('Helvetica');
        yPos += 14;
        yPos = drawTable(doc, headers, rows, yPos, pageWidth, colWidths);
      } else {
        yPos = drawFieldRow(doc, getFieldLabel(key), value.join(', '), yPos, pageWidth);
      }
    } else if (typeof value === 'object') {
      // Render nested objects as sub-section
      if (yPos > 650) { doc.addPage(); yPos = 50; }
      doc.fontSize(9).fillColor('#374151').font('Helvetica-Bold').text(getFieldLabel(key), 50, yPos);
      doc.font('Helvetica');
      yPos += 14;
      for (const [subKey, subVal] of Object.entries(value)) {
        if (subVal === null || subVal === undefined || subVal === '') continue;
        if (typeof subVal === 'object') {
          yPos = drawFieldRow(doc, getFieldLabel(subKey), JSON.stringify(subVal), yPos, pageWidth);
        } else {
          yPos = drawFieldRow(doc, getFieldLabel(subKey), String(subVal), yPos, pageWidth);
        }
      }
      yPos += 5;
    } else if (typeof value === 'boolean') {
      yPos = drawCheckboxField(doc, getFieldLabel(key), value, yPos, pageWidth);
    } else {
      yPos = drawFieldRow(doc, getFieldLabel(key), String(value), yPos, pageWidth);
    }
  }

  return yPos;
}

async function generatePdfBuffer(
  request: any,
  approvalCompletedAt: Date | null,
  formData: Record<string, any>
): Promise<Buffer> {
  // Pre-fetch all signature images
  const signatureBuffers: Map<number, Buffer> = new Map();
  if (request.request_steps) {
    await Promise.all(
      request.request_steps.map(async (step: any, index: number) => {
        const approval = step.approvals?.[0];
        if (approval?.signature_url) {
          const buf = await fetchImageBuffer(approval.signature_url);
          if (buf) signatureBuffers.set(index, buf);
        }
      })
    );
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Approved Request - ${request.title}`,
          Author: 'The Circle - Approval Management System',
          Subject: 'Approved Request Document',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const refNumber = `REQ-${request.id.substring(0, 8).toUpperCase()}`;
      const pageWidth = doc.page.width - 100; // Account for margins
      const pageCenterX = doc.page.width / 2;

      // ── Header: Centred Logo ──
      let logoHeight = 0;
      try {
        const logoPath = path.join(process.cwd(), 'images', 'RTG_LOGO.png');
        if (fs.existsSync(logoPath)) {
          const logoWidth = 160;
          const logoX = pageCenterX - logoWidth / 2;
          doc.image(logoPath, logoX, 35, { width: logoWidth });
          logoHeight = 55; // approximate height of logo at this width
        }
      } catch (e) {
        // Fallback: no logo if file not found
      }

      // Title centred below logo
      const titleY = 35 + logoHeight + 10;
      doc.fontSize(14).fillColor('#111827').font('Helvetica-Bold').text(request.title, 50, titleY, {
        width: pageWidth,
        align: 'center',
      });
      doc.font('Helvetica');

      // Reference and badge
      const refY = titleY + 20;
      doc.fontSize(9).fillColor('#6b7280').text(refNumber, 50, refY, { width: pageWidth, align: 'center' });
      doc.fontSize(9).fillColor('#22c55e').text('FULLY APPROVED', 50, refY + 14, { width: pageWidth, align: 'center' });

      // Divider line
      const dividerY = refY + 30;
      doc.moveTo(50, dividerY).lineTo(545, dividerY).strokeColor('#8B4513').lineWidth(2).stroke();

      let yPos = dividerY + 12;

      // ── Request Info Section ──
      yPos = drawSectionHeading(doc, 'Request Information', yPos, pageWidth);

      const creator = Array.isArray(request.creator) ? request.creator[0] : request.creator;
      const creatorDept = creator?.department ? (Array.isArray(creator.department) ? creator.department[0] : creator.department) : null;

      const infoItems = [
        { label: 'Requester', value: creator?.display_name || 'Unknown' },
        { label: 'Department', value: creatorDept?.name || 'N/A' },
        { label: 'Request Date', value: formatDate(request.created_at) },
        { label: 'Approval Completed', value: approvalCompletedAt ? formatDateTime(approvalCompletedAt.toISOString()) : formatDateTime(request.updated_at) },
      ];

      const colWidth = (pageWidth - 20) / 2;
      infoItems.forEach((item, idx) => {
        if (yPos > 750) { doc.addPage(); yPos = 50; }
        const xPos = 50 + (idx % 2) * (colWidth + 20);
        if (idx > 0 && idx % 2 === 0) yPos += 35;

        doc.rect(xPos, yPos, colWidth, 30).fillColor('#f3f4f6').fill();
        doc.fontSize(7).fillColor('#6b7280').font('Helvetica-Bold').text(item.label.toUpperCase(), xPos + 8, yPos + 5);
        doc.font('Helvetica').fontSize(10).fillColor('#111827').text(item.value, xPos + 8, yPos + 16);
      });

      yPos += 45;

      // ── Form-type-specific content ──
      const formType = detectFormType(request.metadata);

      switch (formType) {
        case 'travel_authorization':
          yPos = renderTravelAuth(doc, formData, yPos, pageWidth, creator, creatorDept);
          break;
        case 'capex': {
          const capexData = formData.capex || formData;
          yPos = renderCapex(doc, capexData, yPos, pageWidth, creator, creatorDept);
          break;
        }
        case 'hotel_booking':
          yPos = renderHotelBooking(doc, formData, yPos, pageWidth, creator, creatorDept);
          break;
        case 'external_hotel_booking':
          yPos = renderExternalHotelBooking(doc, formData, yPos, pageWidth);
          break;
        default:
          yPos = renderGenericForm(doc, formData, yPos, pageWidth);
          break;
      }

      // ── Approval Signatures Section (UNCHANGED) ──
      if (yPos > 500) {
        doc.addPage();
        yPos = 50;
      }

      doc.fontSize(12).fillColor('#374151').text('Approval Signatures', 50, yPos);
      yPos += 25;

      if (request.request_steps && request.request_steps.length > 0) {
        const sigBoxHeight = 110;
        const sigBoxWidth = Math.min(160, (pageWidth - 40) / Math.min(request.request_steps.length, 3));

        request.request_steps.forEach((step: any, index: number) => {
          const approval = step.approvals?.[0];
          const approverName = step.approver?.display_name || approval?.approver?.display_name || 'Unknown';
          const signedAt = approval?.signed_at;
          const role = step.approver_role || `Approver ${index + 1}`;

          // Calculate position (up to 3 per row)
          const colIndex = index % 3;
          if (index > 0 && colIndex === 0) {
            yPos += sigBoxHeight + 10;
            if (yPos > 700) {
              doc.addPage();
              yPos = 50;
            }
          }

          const xPos = 50 + colIndex * (sigBoxWidth + 15);

          // Signature box
          doc.rect(xPos, yPos, sigBoxWidth, sigBoxHeight).strokeColor('#e5e7eb').lineWidth(1).stroke();

          // Role label
          doc.fontSize(8).fillColor('#6b7280').text(role.toUpperCase(), xPos + 5, yPos + 8, {
            width: sigBoxWidth - 10,
            align: 'center',
          });

          // Embed actual signature image if available
          const sigBuffer = signatureBuffers.get(index);
          if (sigBuffer) {
            try {
              doc.image(sigBuffer, xPos + 15, yPos + 22, {
                width: sigBoxWidth - 30,
                height: 35,
                fit: [sigBoxWidth - 30, 35],
                align: 'center',
                valign: 'center',
              });
            } catch {
              doc.fontSize(9).fillColor('#9ca3af').text('Signature on file', xPos + 5, yPos + 35, {
                width: sigBoxWidth - 10,
                align: 'center',
              });
            }
          } else {
            doc.fontSize(9).fillColor('#9ca3af').text('Signature on file', xPos + 5, yPos + 35, {
              width: sigBoxWidth - 10,
              align: 'center',
            });
          }

          // Signature line
          doc.moveTo(xPos + 15, yPos + 62).lineTo(xPos + sigBoxWidth - 15, yPos + 62).strokeColor('#374151').lineWidth(1).stroke();

          // Approver name
          doc.fontSize(9).fillColor('#111827').text(approverName, xPos + 5, yPos + 67, {
            width: sigBoxWidth - 10,
            align: 'center',
          });

          // Decision label
          if (approval?.decision) {
            const decisionColor = approval.decision === 'approved' ? '#22c55e' : '#ef4444';
            doc.fontSize(7).fillColor(decisionColor).text(approval.decision.toUpperCase(), xPos + 5, yPos + 80, {
              width: sigBoxWidth - 10,
              align: 'center',
            });
          }

          // Signed date
          if (signedAt) {
            doc.fontSize(7).fillColor('#6b7280').text(formatDateTime(signedAt), xPos + 5, yPos + 90, {
              width: sigBoxWidth - 10,
              align: 'center',
            });
          }
        });

        // Adjust yPos based on number of signature rows
        const sigRows = Math.ceil(request.request_steps.length / 3);
        yPos += sigBoxHeight + 15;

        // Render approval comments if any
        const comments = request.request_steps
          .map((step: any, idx: number) => {
            const approval = step.approvals?.[0];
            if (!approval?.comment) return null;
            const name = step.approver?.display_name || approval?.approver?.display_name || `Approver ${idx + 1}`;
            return { name, comment: approval.comment };
          })
          .filter(Boolean);

        if (comments.length > 0) {
          if (yPos > 700) {
            doc.addPage();
            yPos = 50;
          }
          doc.fontSize(11).fillColor('#374151').text('Approval Comments', 50, yPos);
          yPos += 18;

          comments.forEach((c: any) => {
            if (yPos > 750) {
              doc.addPage();
              yPos = 50;
            }
            doc.fontSize(9).fillColor('#111827').text(`${c.name}:`, 55, yPos);
            yPos += 14;
            doc.fontSize(9).fillColor('#4b5563').text(c.comment, 65, yPos, { width: pageWidth - 30 });
            yPos += Math.ceil(c.comment.length / 80) * 14 + 8;
          });

          yPos += 5;
        }
      }

      // ── Attached Documents ──
      if (request.documents && request.documents.length > 0) {
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }

        doc.fontSize(12).fillColor('#374151').text('Attached Documents', 50, yPos);
        yPos += 20;

        request.documents.forEach((docItem: any, idx: number) => {
          if (yPos > 750) {
            doc.addPage();
            yPos = 50;
          }
          doc.fontSize(9).fillColor('#6b7280').text(`${idx + 1}.`, 50, yPos);
          doc.fontSize(9).fillColor('#111827').text(docItem.filename, 70, yPos);
          doc.fontSize(8).fillColor('#9ca3af').text(formatDate(docItem.created_at), 400, yPos);
          yPos += 18;
        });

        yPos += 10;
      }

      // ── Footer ──
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      doc.moveTo(50, yPos + 20).lineTo(545, yPos + 20).strokeColor('#e5e7eb').lineWidth(1).stroke();

      doc.fontSize(9).fillColor('#9ca3af').text(
        'This document certifies that the above request has been reviewed and approved by all required approvers.',
        50,
        yPos + 35,
        { width: pageWidth, align: 'center' }
      );

      doc.fontSize(8).fillColor('#9ca3af').text(
        'The Circle - Approval Management System - Rainbow Tourism Group Ltd',
        50,
        yPos + 55,
        { width: pageWidth, align: 'center' }
      );

      doc.fontSize(7).fillColor('#d1d5db').text(
        `Document ID: ${request.id}  |  Archived: ${new Date().toISOString()}`,
        50,
        yPos + 70,
        { width: pageWidth, align: 'center' }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
