import LegalLayout from '@/components/legal/LegalLayout';

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" updated="5 July 2026">
      <p>
        This Privacy Policy explains how <strong>Rainbow Tourism Group</strong> (“RTG”, “we”, “us”)
        collects, uses, and protects personal information when you use <strong>The Circle</strong>,
        our internal approvals and workflow platform. RTG is the data controller for the information
        processed within The Circle.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Identity &amp; profile:</strong> your name, work email, job title, department, business unit, and reporting line — sourced from your RTG Microsoft account and the HR Information System (HRIMS / RTG Atlas).</li>
        <li><strong>Approval activity:</strong> the requests you raise, the approvals and rejections you make, comments, and the digital signature you apply.</li>
        <li><strong>Digital signature:</strong> the signature image you draw, upload, or capture, used to authorise approvals.</li>
        <li><strong>Device &amp; security metadata:</strong> when you register a device for verification, we record identifiable, non-sensitive details such as a device label (e.g. “Chrome · Windows”), the authenticator type, transports, and timestamps — so you can recognise and manage your devices.</li>
        <li><strong>Audit &amp; usage logs:</strong> sign-in events, actions taken, and technical information (such as IP address and browser) recorded for security and compliance.</li>
      </ul>

      <h2>2. Biometric data</h2>
      <p>
        The Circle supports passkeys and biometric verification (Windows Hello, Touch ID, Face ID,
        Android fingerprint, and similar). <strong>Your fingerprint, face, or screen-lock data never
        leaves your device and is never transmitted to or stored by RTG.</strong> We only receive and
        store a public cryptographic key and a confirmation that verification succeeded on your
        device.
      </p>

      <h2>3. How we use your information</h2>
      <ul>
        <li>to authenticate you and route requests to the correct approvers;</li>
        <li>to record and evidence approvals with a legally binding signature and audit trail;</li>
        <li>to secure the platform, detect misuse, and support internal and external audit; and</li>
        <li>to operate, maintain, and improve The Circle.</li>
      </ul>

      <h2>4. Legal basis</h2>
      <p>
        We process this information to perform and administer your employment or engagement with RTG,
        to meet our legal and regulatory obligations, and in pursuit of RTG’s legitimate interests in
        running a secure, accountable approvals process.
      </p>

      <h2>5. Who we share it with</h2>
      <p>
        Information is visible internally only to colleagues whose role requires it (for example,
        approvers in your workflow, finance, audit, and system administrators). We also rely on
        trusted service providers who process data on our behalf under appropriate safeguards —
        including <strong>Microsoft</strong> (identity and email) and our cloud database and hosting
        providers. We do not sell your personal information.
      </p>

      <h2>6. Retention</h2>
      <p>
        Approval records, signatures, and audit logs are retained for as long as required to meet
        RTG’s operational, legal, tax, and audit obligations. Registered devices are retained until
        you or an administrator remove them. Other personal data is kept only as long as necessary for
        the purposes above.
      </p>

      <h2>7. Security</h2>
      <p>
        We apply technical and organisational measures to protect your information, including access
        controls, encryption in transit, row-level database security, and immutable audit logging.
        No system is perfectly secure, but we work to protect your data and to respond promptly to any
        incident.
      </p>

      <h2>8. Your rights</h2>
      <p>
        Subject to applicable law and RTG policy, you may request access to, or correction of, the
        personal information we hold about you. Note that some records — such as approvals and audit
        logs — must be retained for compliance and cannot be deleted on request. To exercise a right,
        contact the team below.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Where changes are material, we will make
        reasonable efforts to notify you. The “last updated” date above reflects the current version.
      </p>

      <h2>10. Contact</h2>
      <p>
        For privacy questions or requests, contact the RTG ICT / Finance Systems team through the
        in-app <strong>Report a Bug</strong> channel or your usual internal support contact.
      </p>
    </LegalLayout>
  );
}
