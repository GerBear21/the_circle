import { NextApiRequest, NextApiResponse } from 'next';
import PDFDocument from 'pdfkit';
import { guardAuditApi, parseAuditFilters, buildAuditQuery } from '@/lib/auditAccess';
import { audit } from '@/lib/auditLog';

const EXPORT_LIMIT = 5000;

/**
 * GET /api/audit/export?format=csv|pdf — export the filtered audit log.
 * Honours the same filters as /api/audit/events. The export itself is
 * recorded as a compliance event (audit access must itself be audited).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const guard = await guardAuditApi(req, res, ['audit.export']);
  if (!guard) return;

  try {
    const format = req.query.format === 'pdf' ? 'pdf' : 'csv';
    const filters = parseAuditFilters(req.query);

    const { data, error } = await buildAuditQuery(filters, guard.user.org_id).range(0, EXPORT_LIMIT - 1);
    if (error) throw error;
    const events = data || [];

    await audit(req, guard.user, {
      category: 'compliance',
      action: 'audit.report_exported',
      severity: 'notice',
      details: {
        format,
        rowCount: events.length,
        filters: {
          category: filters.category, severity: filters.severity, outcome: filters.outcome,
          action: filters.action, search: filters.search, from: filters.from, to: filters.to,
        },
      },
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    if (format === 'csv') {
      const headers = [
        'Sequence', 'Occurred At (UTC)', 'Category', 'Action', 'Severity', 'Outcome',
        'Actor', 'Actor Email', 'IP Address', 'Target Type', 'Target', 'Details', 'Entry Hash',
      ];
      const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = events.map((e: any) => [
        e.sequence_number, e.occurred_at, e.category, e.action, e.severity, e.outcome,
        e.actor_name, e.actor_email, e.ip_address, e.target_type,
        e.target_label || e.target_id, JSON.stringify(e.details), e.entry_hash,
      ].map(escape).join(','));

      const csv = [headers.map(escape).join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit_report_${stamp}.csv"`);
      return res.status(200).send(csv);
    }

    // PDF report
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="audit_report_${stamp}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    doc.pipe(res);

    doc.fontSize(16).fillColor('#1f2937').text('The Circle — Audit Report', { continued: false });
    doc.moveDown(0.2);
    doc.fontSize(9).fillColor('#6b7280')
      .text(`Generated ${new Date().toISOString()} by ${guard.user.name || guard.user.email}`)
      .text(`Events: ${events.length}${events.length >= EXPORT_LIMIT ? ' (truncated at export limit)' : ''}`)
      .text(`Filters: ${[
        filters.category && `category=${filters.category}`,
        filters.severity && `severity=${filters.severity}`,
        filters.outcome && `outcome=${filters.outcome}`,
        filters.search && `search="${filters.search}"`,
        filters.from && `from=${filters.from}`,
        filters.to && `to=${filters.to}`,
      ].filter(Boolean).join(', ') || 'none'}`)
      .text('Integrity: every entry below is part of a SHA-256 hash chain; the Entry Hash column allows independent verification.');
    doc.moveDown(0.8);

    const cols = [
      { key: 'sequence_number', label: '#', width: 34 },
      { key: 'occurred_at', label: 'Occurred (UTC)', width: 105 },
      { key: 'category', label: 'Category', width: 62 },
      { key: 'action', label: 'Action', width: 110 },
      { key: 'severity', label: 'Severity', width: 48 },
      { key: 'outcome', label: 'Outcome', width: 50 },
      { key: 'actor_name', label: 'Actor', width: 95 },
      { key: 'target', label: 'Target', width: 120 },
      { key: 'entry_hash', label: 'Entry Hash (prefix)', width: 90 },
    ];

    const drawHeader = () => {
      let x = doc.page.margins.left;
      const y = doc.y;
      doc.fontSize(7.5).fillColor('#374151').font('Helvetica-Bold');
      cols.forEach((c) => { doc.text(c.label, x, y, { width: c.width - 4 }); x += c.width; });
      doc.font('Helvetica');
      doc.moveDown(0.4);
      doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .strokeColor('#d1d5db').lineWidth(0.5).stroke();
      doc.moveDown(0.2);
    };

    drawHeader();
    doc.fontSize(7).fillColor('#111827');

    for (const e of events) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 24) {
        doc.addPage();
        drawHeader();
        doc.fontSize(7).fillColor('#111827');
      }
      const rowY = doc.y;
      let x = doc.page.margins.left;
      const cells: Record<string, string> = {
        sequence_number: String(e.sequence_number),
        occurred_at: String(e.occurred_at).replace('T', ' ').slice(0, 19),
        category: e.category,
        action: e.action,
        severity: e.severity,
        outcome: e.outcome,
        actor_name: e.actor_name || 'System',
        target: e.target_label || e.target_id || '—',
        entry_hash: String(e.entry_hash || '').slice(0, 16) + '…',
      };
      let maxH = 0;
      cols.forEach((c) => {
        const text = cells[c.key] || '';
        doc.text(text, x, rowY, { width: c.width - 4 });
        maxH = Math.max(maxH, doc.heightOfString(text, { width: c.width - 4 }));
        x += c.width;
      });
      doc.y = rowY + maxH + 3;
    }

    doc.end();
  } catch (error: any) {
    console.error('Audit export API error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message || 'Failed to export audit report' });
    }
  }
}
