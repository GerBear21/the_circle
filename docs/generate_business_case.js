// The Circle — Business Case Document Generator
// Rainbow Tourism Group Limited
process.env.NODE_PATH = "C:/Users/Admin/AppData/Roaming/npm/node_modules";
require("module").Module._initPaths();

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  LevelFormat, TableOfContents
} = require("docx");
const fs = require("fs");

// ── Brand colours ────────────────────────────────────────────────────────────
const RTG_BROWN  = "5C3317";
const RTG_GOLD   = "B8860B";
const RTG_CREAM  = "FBF5EC";
const RTG_LIGHT  = "F5EFE6";
const WHITE      = "FFFFFF";
const DARK_TEXT  = "1A1A1A";
const MID_GREY   = "666666";

// ── Helpers ──────────────────────────────────────────────────────────────────
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "D0C0A0" };
const thinBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

const headerBorder = { style: BorderStyle.SINGLE, size: 4, color: "D0C0A0" };
const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

function spacer(pts) {
  return new Paragraph({ spacing: { before: pts * 20, after: 0 }, children: [] });
}

function rule(color = "D0C0A0") {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color } },
    spacing: { before: 0, after: 120 },
    children: []
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 120 },
    children: [
      new TextRun({ text, font: "Arial", size: 26, bold: true, color: RTG_BROWN })
    ]
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 80 },
    children: [
      new TextRun({ text, font: "Arial", size: 22, bold: true, color: RTG_BROWN })
    ]
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 100 },
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: 20,
        color: opts.color || DARK_TEXT,
        bold: opts.bold || false,
        italics: opts.italics || false
      })
    ]
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 20, color: DARK_TEXT })]
  });
}

// ── Table helpers ─────────────────────────────────────────────────────────────
function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: headerBorders,
    shading: { fill: RTG_BROWN, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      children: [new TextRun({ text, font: "Arial", size: 18, bold: true, color: WHITE })]
    })]
  });
}

function dataCell(text, width, shade = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: thinBorders,
    shading: { fill: shade ? RTG_LIGHT : WHITE, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.TOP,
    children: [new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text, font: "Arial", size: 18, color: DARK_TEXT })]
    })]
  });
}

function dataCellBold(text, width, shade = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: thinBorders,
    shading: { fill: shade ? RTG_LIGHT : WHITE, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.TOP,
    children: [new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text, font: "Arial", size: 18, bold: true, color: DARK_TEXT })]
    })]
  });
}

function twoColTable(rows, widths = [3000, 6026]) {
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map(([a, b], i) => new TableRow({
      children: [dataCellBold(a, widths[0], i % 2 === 0), dataCell(b, widths[1], i % 2 === 0)]
    }))
  });
}

function threeColTable(headers, rows, widths = [3000, 3013, 3013]) {
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ children: headers.map((h, i) => headerCell(h, widths[i])) }),
      ...rows.map(([a, b, c], i) => new TableRow({
        children: [
          dataCellBold(a, widths[0], i % 2 === 0),
          dataCell(b, widths[1], i % 2 === 0),
          dataCell(c, widths[2], i % 2 === 0)
        ]
      }))
    ]
  });
}

function fourColTable(headers, rows, widths = [2200, 2400, 2400, 2026]) {
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ children: headers.map((h, i) => headerCell(h, widths[i])) }),
      ...rows.map(([a, b, c, d], i) => new TableRow({
        children: [
          dataCellBold(a, widths[0], i % 2 === 0),
          dataCell(b, widths[1], i % 2 === 0),
          dataCell(c, widths[2], i % 2 === 0),
          dataCell(d, widths[3], i % 2 === 0)
        ]
      }))
    ]
  });
}

// ── Logo ──────────────────────────────────────────────────────────────────────
const logoData = fs.readFileSync("C:\\Users\\Admin\\the_circle\\RTG_LOGO.png");

const logoParagraph = new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 200 },
  children: [
    new ImageRun({
      type: "png",
      data: logoData,
      transformation: { width: 150, height: 90 },
      altText: { title: "RTG Logo", description: "Rainbow Tourism Group Limited", name: "RTG_Logo" }
    })
  ]
});

// ── Header ────────────────────────────────────────────────────────────────────
const docHeader = new Header({
  children: [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D0C0A0" } },
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({ text: "THE CIRCLE — Business Case  |  Rainbow Tourism Group Limited  |  CONFIDENTIAL", font: "Arial", size: 16, color: MID_GREY })
      ]
    })
  ]
});

// ── Footer ────────────────────────────────────────────────────────────────────
const docFooter = new Footer({
  children: [
    new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "D0C0A0" } },
      spacing: { before: 120, after: 0 },
      tabStops: [{ type: "right", position: 9026 }],
      children: [
        new TextRun({ text: "INTERNAL — CONFIDENTIAL", font: "Arial", size: 16, color: MID_GREY }),
        new TextRun({ text: "\tPage ", font: "Arial", size: 16, color: MID_GREY }),
        new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: MID_GREY }),
        new TextRun({ text: " of ", font: "Arial", size: 16, color: MID_GREY }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Arial", size: 16, color: MID_GREY })
      ]
    })
  ]
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DOCUMENT SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── COVER PAGE ────────────────────────────────────────────────────────────────
const coverPage = [
  spacer(100),
  logoParagraph,
  spacer(40),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
    children: [
      new TextRun({ text: "Rainbow Tourism Group Limited", font: "Arial", size: 22, color: MID_GREY })
    ]
  }),
  spacer(80),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    border: {
      top: { style: BorderStyle.SINGLE, size: 8, color: RTG_BROWN },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: RTG_BROWN }
    },
    spacing: { before: 200, after: 200 },
    children: [
      new TextRun({ text: "THE CIRCLE", font: "Arial", size: 52, bold: true, color: RTG_BROWN })
    ]
  }),
  spacer(40),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: [
      new TextRun({ text: "Enterprise Approval Platform", font: "Arial", size: 32, color: RTG_BROWN })
    ]
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
    children: [
      new TextRun({ text: "B U S I N E S S   C A S E", font: "Arial", size: 24, bold: true, color: RTG_GOLD, characterSpacing: 60 })
    ]
  }),
  spacer(120),
  new Table({
    width: { size: 5000, type: WidthType.DXA },
    columnWidths: [2200, 2800],
    rows: [
      ["Document Reference", "RTG-BC-CIRCLE-001"],
      ["Version",           "1.0"],
      ["Date",              "16 June 2026"],
      ["Status",            "Draft — Pending Approval"],
      ["Classification",    "INTERNAL — CONFIDENTIAL"],
      ["Document Owner",    "IT Director / Project Sponsor"],
    ].map(([a, b], i) => new TableRow({
      children: [
        new TableCell({
          width: { size: 2200, type: WidthType.DXA },
          borders: thinBorders,
          shading: { fill: i % 2 === 0 ? RTG_LIGHT : WHITE, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: a, font: "Arial", size: 17, bold: true, color: RTG_BROWN })] })]
        }),
        new TableCell({
          width: { size: 2800, type: WidthType.DXA },
          borders: thinBorders,
          shading: { fill: i % 2 === 0 ? RTG_LIGHT : WHITE, type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: b, font: "Arial", size: 17, color: DARK_TEXT })] })]
        })
      ]
    }))
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 0 },
    children: []
  }),
  spacer(80),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text: "Approval", font: "Arial", size: 18, bold: true, color: RTG_BROWN })]
  }),
  new Table({
    width: { size: 7000, type: WidthType.DXA },
    columnWidths: [2500, 2500, 2000],
    rows: [
      new TableRow({ children: [headerCell("Role", 2500), headerCell("Name / Title", 2500), headerCell("Date", 2000)] }),
      ...["Prepared by", "Reviewed by", "Approved by"].map((r, i) =>
        new TableRow({
          children: [
            dataCellBold(r, 2500, i % 2 === 0),
            dataCell("", 2500, i % 2 === 0),
            dataCell("", 2000, i % 2 === 0)
          ]
        })
      )
    ]
  }),
  new Paragraph({ children: [new PageBreak()] })
];

// ── SECTION 1: EXECUTIVE SUMMARY ──────────────────────────────────────────────
const section1 = [
  heading1("1.  Executive Summary"),
  rule(RTG_GOLD),
  body("Rainbow Tourism Group Limited (RTG) operates across a portfolio of hospitality and tourism assets and relies on manual, paper-based, or ad hoc email-driven processes to manage internal approvals — from capital expenditure authorisation to travel requests and financial instruments. These processes carry material compliance, efficiency, and governance risk."),
  body("This business case seeks approval for The Circle, a purpose-built, internally developed Enterprise Approval Platform that digitises, governs, and audits all approval workflows across the organisation."),
  spacer(40),
  body("The Circle delivers the following outcomes:", { bold: true }),
  bullet("A single, governed digital channel for all internal approval requests."),
  bullet("Cryptographically verifiable, legally defensible audit trails for every decision."),
  bullet("Risk-based authentication that scales security to the value and sensitivity of each transaction."),
  bullet("Real-time workflow visibility, eliminating the opacity of email-chain approvals."),
  bullet("A modular architecture that supports continuous expansion — the Finance module is live, and Legal, Procurement, and HR modules are planned."),
  spacer(40),
  body("The platform is substantially built and is approaching production readiness. This business case documents the strategic rationale, expected benefits, cost envelope, and approval required to proceed to full deployment.", { italics: true }),
];

// ── SECTION 2: BUSINESS PROBLEM ───────────────────────────────────────────────
const section2 = [
  spacer(20),
  heading1("2.  Business Problem"),
  rule(RTG_GOLD),
  heading2("2.1  Current State"),
  body("RTG's current approval processes are characterised by the following weaknesses:"),
  spacer(20),
  fourColTable(
    ["Problem Area", "Description", "Business Impact", "Risk Rating"],
    [
      ["No identity binding",     "Paper and email approvals cannot verify the approver's identity at the moment of decision.",         "Fraud exposure; invalid approvals.",          "HIGH"],
      ["No structured audit trail","Decisions are dispersed across inboxes and filing cabinets; reconstruction is manual and incomplete.", "Audit failure; regulatory exposure.",         "HIGH"],
      ["Workflow opacity",        "Requesters cannot track where a request sits or what is blocking it.",                               "Delays; management escalations.",             "MEDIUM"],
      ["Untracked delegation",    "Ad hoc verbal or email delegations are not recorded or time-bounded.",                              "Accountability gaps; audit findings.",         "HIGH"],
      ["No risk differentiation", "A petty cash request and a multi-million dollar CAPEX are processed through the same email chain.", "Insufficient control for high-value decisions.","CRITICAL"],
      ["Manual archiving",        "Approved documents are stored inconsistently, often not at all.",                                   "No evidence trail for audit or dispute.",      "HIGH"],
    ],
    [2000, 2826, 2200, 2000]
  ),

  heading2("2.2  Strategic Imperative"),
  body("RTG operates in a regulated environment and is subject to internal audit, external audit, and sector governance requirements. The current manual approval regime is incompatible with the governance maturity expected of an organisation of RTG's scale and profile. The risk of a material audit finding, a fraudulent approval, or a compliance breach under the current process is significant and increasing."),
];

// ── SECTION 3: PROPOSED SOLUTION ─────────────────────────────────────────────
const section3 = [
  spacer(20),
  heading1("3.  Proposed Solution"),
  rule(RTG_GOLD),
  heading2("3.1  Solution Overview"),
  body("The Circle is an internally developed, web-based enterprise approval platform built on modern, maintainable technology. It provides a structured digital channel for every approval workflow in the organisation, enforcing authentication, capturing signatures, and generating immutable audit records automatically."),
  spacer(20),
  body("Core capabilities:", { bold: true }),
  spacer(10),
  threeColTable(
    ["Capability", "Description", "Status"],
    [
      ["Multi-Step Workflow Engine",     "Sequential and parallel approval chains, configurable per request type.",           "Live"],
      ["Risk-Based Authentication",      "Automatically escalates from session confirmation → Microsoft MFA → biometric based on transaction value and sensitivity.", "Live"],
      ["Electronic Signatures",          "Legally attributable signatures (drawn, typed, or pre-saved) captured at point of decision.", "Live"],
      ["Immutable Audit Trail",          "Every decision recorded with identity, timestamp, device fingerprint, authentication method, and signature reference.", "Live"],
      ["Role-Based Access Control",      "Granular, scoped permissions with expiring assignments and formal delegation management.", "Live"],
      ["Automated PDF Archiving",        "Tamper-evident archive generated automatically on workflow completion.",              "Live"],
      ["HRIMS Integration",              "Approvers resolved dynamically from the live organisational chart.",                 "Live"],
      ["Real-Time Notifications",        "In-app and email alerts at every workflow stage transition.",                       "Live"],
      ["Dashboard & Reporting",          "Live KPI metrics, SLA compliance tracking, and request analytics.",                 "Live"],
      ["Custom Form Builder",            "Any department can digitise a paper form without code changes.",                    "Live"],
    ],
    [2600, 4200, 2226]
  ),

  heading2("3.2  Request Types — Finance Module (Phase 1)"),
  body("The following request types are live within the Finance module:"),
  spacer(10),
  twoColTable([
    ["Capital Expenditure (CAPEX)",       "Multi-level approval with post-approval funding lifecycle tracker."],
    ["Travel Authorisation",              "Local and international travel with HR cost-centre allocation."],
    ["Hotel Complimentaries",             "Internal staff accommodation bookings with structured approval chain."],
    ["External Complimentary Vouchers",   "Partner/guest accommodation vouchers with transparency controls."],
    ["Petty Cash Requests",               "Digitised disbursement with cost-centre allocation and full audit."],
    ["Debit / Credit Notes",              "Financial adjustment notes with authorised signatory capture."],
    ["Journal Entries",                   "Finance-governed journal entry approvals replacing paper submissions."],
    ["General Ledger Postings",           "GL posting requests with mandatory finance approval and documentation."],
    ["Voucher Requests",                  "Cost-centre voucher issuance with full authorisation trail."],
    ["Custom / Ad Hoc Forms",             "Any departmental form digitised on demand via the form builder."],
  ], [3000, 6026]),
];

// ── SECTION 4: STRATEGIC ALIGNMENT & ROADMAP ─────────────────────────────────
const section4 = [
  spacer(20),
  heading1("4.  Strategic Alignment & Expansion Roadmap"),
  rule(RTG_GOLD),
  heading2("4.1  Strategic Alignment"),
  body("The Circle directly supports the following RTG strategic objectives:"),
  spacer(10),
  twoColTable([
    ["Governance & Compliance",    "Establishes a demonstrable, audit-ready approval control framework across the organisation."],
    ["Risk Management",            "Eliminates material fraud and compliance exposure from uncontrolled manual approval processes."],
    ["Operational Efficiency",     "Reduces approval cycle time through automated routing, parallel processing, and real-time notification."],
    ["Digital Transformation",     "Replaces paper-based and email-driven processes with a governed, scalable digital platform."],
    ["Talent & Culture",           "Provides employees with a modern, transparent, and responsive experience for administrative requests."],
  ], [2800, 6226]),

  heading2("4.2  Modular Expansion Roadmap"),
  body("The Circle is designed as a continuously growing platform. The Finance module is the first delivered module. The following modules are planned:"),
  spacer(10),
  fourColTable(
    ["Module", "Scope", "Priority", "Target Quarter"],
    [
      ["Finance (Phase 1)",      "CAPEX, Travel, Accommodation, Petty Cash, Journals, Vouchers, Credit/Debit Notes.", "Complete",  "Q2 2026"],
      ["Legal",                  "Contract review and sign-off workflows; NDA approvals; regulatory submissions; legal opinion requests.", "HIGH", "Q3 2026"],
      ["Procurement",            "Purchase order approvals, supplier onboarding, vendor contract sign-offs.",           "HIGH",      "Q4 2026"],
      ["Human Resources",        "Leave approvals, disciplinary processes, recruitment authorisations.",                "MEDIUM",    "Q1 2027"],
      ["IT & Infrastructure",    "Access provisioning, change requests, system decommissioning approvals.",            "MEDIUM",    "Q2 2027"],
      ["Executive Governance",   "Board resolution workflows, policy approvals, strategic investment sign-offs.",      "PLANNED",   "TBC"],
    ],
    [1900, 3626, 1500, 2000]
  ),
  body("Each new module is additive — no re-architecture is required. The workflow engine, RBAC system, audit trail, and authentication framework serve all modules from a single shared platform.", { italics: true }),
];

// ── SECTION 5: BENEFITS & COSTS ───────────────────────────────────────────────
const section5 = [
  spacer(20),
  heading1("5.  Benefits & Cost Estimate"),
  rule(RTG_GOLD),
  heading2("5.1  Expected Benefits"),
  spacer(10),
  fourColTable(
    ["Benefit", "Description", "Type", "Measurable Indicator"],
    [
      ["Audit Readiness",         "Every approval decision is evidenced with authentication proof and a timestamped signature.",                  "Qualitative / Risk",   "Zero audit findings on approval controls."],
      ["Fraud Prevention",        "High-value approvals require biometric or MFA authentication, making unauthorised approvals infeasible.",     "Risk Reduction",       "Zero fraudulent approvals post-go-live."],
      ["Cycle Time Reduction",    "Automated routing and parallel processing eliminates manual forwarding delays.",                              "Quantitative",         "≥ 50% reduction in average approval time."],
      ["Process Consistency",     "All requests follow a defined, templated workflow — no deviation, no ad hoc handling.",                       "Qualitative",          "100% of requests follow defined templates."],
      ["Compliance Assurance",    "Immutable audit trail with device fingerprinting supports regulatory and legal scrutiny.",                    "Risk Reduction",       "Full audit reconstruction in < 5 minutes."],
      ["Management Visibility",   "Real-time dashboard gives management a live view of workflow performance and bottlenecks.",                   "Qualitative",          "Live SLA compliance reporting available."],
      ["Cost Avoidance",          "Eliminates printing, physical filing, manual chasing, and re-processing of lost or incorrectly routed forms.","Quantitative",         "Estimated staff hours saved per annum."],
    ],
    [2000, 3026, 1800, 2200]
  ),

  heading2("5.2  Cost Summary"),
  body("The Circle is an internally developed platform. There is no third-party software licence fee for the core application. Costs are limited to:"),
  spacer(10),
  threeColTable(
    ["Cost Item", "Description", "Classification"],
    [
      ["Infrastructure — Supabase",       "PostgreSQL database, file storage, and real-time subscriptions (cloud-hosted, pay-as-you-go).",   "Operating Expenditure"],
      ["Infrastructure — Vercel",         "Application hosting and serverless compute.",                                                    "Operating Expenditure"],
      ["Microsoft Entra ID",              "SSO and MFA — covered under existing RTG Microsoft 365 licensing.",                             "Existing Licence"],
      ["Email — Resend",                  "Transactional email notifications (volume-based pricing).",                                     "Operating Expenditure"],
      ["Internal Development",            "Ongoing development for new modules, enhancements, and maintenance (internal resource).",       "Staff Cost"],
      ["Security Review & Penetration Test", "One-time professional penetration test and compliance review prior to production go-live.", "Capital Expenditure"],
      ["User Training",                   "Internal training materials and onboarding sessions for staff and administrators.",             "One-Time Cost"],
    ],
    [2400, 4226, 2400]
  ),
  body("A detailed financial analysis with specific cost estimates will be provided in the Project Initiation Document upon approval of this business case.", { italics: true }),
];

// ── SECTION 6: RISK SUMMARY ───────────────────────────────────────────────────
const section6 = [
  spacer(20),
  heading1("6.  Key Risks"),
  rule(RTG_GOLD),
  body("The following risks have been identified. A full risk register is maintained in the Project Initiation Document."),
  spacer(10),
  fourColTable(
    ["Risk", "Impact", "Rating", "Mitigation"],
    [
      ["Supabase RLS policies not yet confirmed at database level.", "Unauthorised data access if API controls are bypassed.", "HIGH",     "Implement and document row-level security policies prior to go-live."],
      ["Legal sufficiency of electronic signatures not reviewed.",  "Signatures may not meet statutory requirements for certain document types.",  "HIGH",     "Engage legal counsel to review signature adequacy; integrate QES provider if required."],
      ["Data retention policy absent.",                             "Retention of personal data (IP, device info) beyond legal limits.", "HIGH",     "Define and implement a documented retention and purging policy."],
      ["Biometric enrolment not mandated for high-risk approvers.", "HIGH-risk approvals fall back to MFA, reducing assurance level.", "MEDIUM",   "Require enrolment as a condition of HIGH-risk approver role assignment."],
      ["HRIMS organogram unavailability.",                          "Workflows requiring dynamic approver resolution will fail.",        "MEDIUM",   "Implement organogram caching and manual fallback assignment."],
      ["Scope expansion without governance.",                       "Adding new modules without structured review risks quality regression.", "MEDIUM", "Each new module follows a defined design, review, test, and approval cycle."],
    ],
    [2300, 2626, 1000, 3100]
  ),
];

// ── SECTION 7: RECOMMENDATION & APPROVALS ────────────────────────────────────
const section7 = [
  spacer(20),
  heading1("7.  Recommendation"),
  rule(RTG_GOLD),
  body("It is recommended that RTG's Executive Committee approves The Circle for full production deployment, subject to the following conditions:"),
  spacer(10),
  bullet("Completion of the database security review and implementation of Supabase row-level security policies."),
  bullet("Legal review of electronic signature sufficiency for all document types in scope."),
  bullet("Definition and implementation of a data retention and purging policy."),
  bullet("Successful penetration test with no critical findings outstanding at go-live."),
  bullet("User acceptance testing completed and signed off by departmental heads."),
  spacer(40),
  body("Subject to the above conditions, The Circle represents a significant and necessary step in RTG's governance maturity and digital transformation journey. The platform is technically sophisticated, substantially complete, and purpose-built for RTG's operational context."),
  spacer(60),
  heading2("7.1  Decision Required"),
  spacer(10),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [2800, 3226, 3000],
    rows: [
      new TableRow({ children: [headerCell("Decision", 2800), headerCell("Name / Title", 3226), headerCell("Signature & Date", 3000)] }),
      ...["Approved", "Rejected", "Deferred — Conditions"].map((d, i) =>
        new TableRow({
          children: [
            dataCellBold(d, 2800, i % 2 === 0),
            dataCell("", 3226, i % 2 === 0),
            dataCell("", 3000, i % 2 === 0)
          ]
        })
      )
    ]
  }),
  spacer(60),
  heading2("7.2  Document Approval"),
  spacer(10),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [2400, 2400, 2226, 2000],
    rows: [
      new TableRow({ children: [headerCell("Role", 2400), headerCell("Name", 2400), headerCell("Signature", 2226), headerCell("Date", 2000)] }),
      ...["Prepared by", "Reviewed by", "Endorsed by", "Approved by"].map((r, i) =>
        new TableRow({
          children: [
            dataCellBold(r, 2400, i % 2 === 0),
            dataCell("", 2400, i % 2 === 0),
            dataCell("", 2226, i % 2 === 0),
            dataCell("", 2000, i % 2 === 0)
          ]
        })
      )
    ]
  }),
  spacer(60),
  rule("D0C0A0"),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 0 },
    children: [
      new TextRun({ text: "Rainbow Tourism Group Limited  |  The Circle — Business Case  |  v1.0  |  16 June 2026  |  INTERNAL — CONFIDENTIAL", font: "Arial", size: 16, color: MID_GREY })
    ]
  })
];

// ── DOCUMENT CONTROL PAGE ─────────────────────────────────────────────────────
const docControlPage = [
  heading1("Document Control"),
  rule(RTG_GOLD),
  heading2("Change History"),
  spacer(10),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [1000, 1800, 2226, 4000],
    rows: [
      new TableRow({ children: [headerCell("Version", 1000), headerCell("Date", 1800), headerCell("Author", 2226), headerCell("Description", 4000)] }),
      new TableRow({ children: [dataCell("1.0", 1000), dataCell("16 June 2026", 1800), dataCell("IT Project Team", 2226), dataCell("Initial draft for Executive review.", 4000)] })
    ]
  }),
  spacer(20),
  heading2("Distribution"),
  spacer(10),
  twoColTable([
    ["Executive Committee",  "For approval decision."],
    ["IT Director",          "Document owner and author."],
    ["Finance Director",     "Stakeholder review — Finance module in scope."],
    ["Internal Audit",       "Assurance review."],
    ["Legal Counsel",        "Review of signature and compliance considerations."],
  ], [2800, 6226]),
  new Paragraph({ children: [new PageBreak()] })
];

// ═══════════════════════════════════════════════════════════════════════════════
//  ASSEMBLE DOCUMENT
// ═══════════════════════════════════════════════════════════════════════════════

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 480, hanging: 240 } } }
        }]
      }
    ]
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 20, color: DARK_TEXT } }
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: RTG_BROWN },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 0 }
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial", color: RTG_BROWN },
        paragraph: { spacing: { before: 220, after: 80 }, outlineLevel: 1 }
      }
    ]
  },
  sections: [
    // Cover page — no header/footer
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children: coverPage
    },
    // Main document — with header/footer
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 }
        }
      },
      headers: { default: docHeader },
      footers: { default: docFooter },
      children: [
        ...docControlPage,
        ...section1,
        new Paragraph({ children: [new PageBreak()] }),
        ...section2,
        new Paragraph({ children: [new PageBreak()] }),
        ...section3,
        new Paragraph({ children: [new PageBreak()] }),
        ...section4,
        new Paragraph({ children: [new PageBreak()] }),
        ...section5,
        new Paragraph({ children: [new PageBreak()] }),
        ...section6,
        new Paragraph({ children: [new PageBreak()] }),
        ...section7
      ]
    }
  ]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("C:\\Users\\Admin\\the_circle\\docs\\The_Circle_Business_Case_v1.0.docx", buffer);
  console.log("SUCCESS: Document written to docs/The_Circle_Business_Case_v1.0.docx");
}).catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});
