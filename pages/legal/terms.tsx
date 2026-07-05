import LegalLayout from '@/components/legal/LegalLayout';

export default function TermsOfUse() {
  return (
    <LegalLayout title="Terms of Use" updated="5 July 2026">
      <p>
        These Terms of Use (“Terms”) govern your access to and use of <strong>The Circle</strong>, the
        approvals and workflow platform operated by <strong>Rainbow Tourism Group</strong> and its
        subsidiaries (“RTG”, “we”, “us”). The Circle is an internal business system provided to
        authorised employees, officers, and contractors of RTG. By signing in and ticking the consent
        box, you confirm that you have read, understood, and agree to be bound by these Terms.
      </p>

      <h2>1. Authorised use</h2>
      <p>
        The Circle is made available strictly for legitimate RTG business purposes — raising requests,
        reviewing and authorising approvals, managing workflows, and related activities. You may use
        the platform only within the scope of your role and the permissions assigned to you. Any use
        for personal gain, or on behalf of a third party without authorisation, is prohibited.
      </p>

      <h2>2. Your account and access</h2>
      <ul>
        <li>Access is granted through your RTG Microsoft account. You are responsible for keeping your credentials confidential and for all activity that occurs under your account.</li>
        <li>Your role, department, and reporting line are drawn from RTG’s HR Information System (HRIMS / RTG Atlas). You must ensure this information is accurate and report any discrepancies.</li>
        <li>You must not share your account, impersonate another person, or attempt to access data or functions beyond your assigned permissions.</li>
      </ul>

      <h2>3. Digital signatures and approvals</h2>
      <p>
        The Circle uses your registered digital signature to authorise approvals. You acknowledge and
        agree that:
      </p>
      <ul>
        <li>Your digital signature is the legal equivalent of your handwritten signature and is <strong>binding</strong> on you and, where applicable, on RTG.</li>
        <li>Every approval, rejection, or authorisation you make is attributable to you and is recorded in an immutable audit trail.</li>
        <li>You will only approve items you are authorised to approve and that you have reviewed in good faith.</li>
      </ul>

      <h2>4. Device registration and verification</h2>
      <p>
        For higher-value actions, The Circle may ask you to verify your identity using a passkey
        registered to your device (for example Windows Hello, Touch ID, Face ID, an Android
        fingerprint, or a passkey on your phone). Your biometric data never leaves your device — The
        Circle only receives a cryptographic confirmation that verification succeeded. You are
        responsible for registering devices that are under your control and for removing devices you
        no longer use.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>upload unlawful, false, or misleading information;</li>
        <li>attempt to disrupt, probe, reverse-engineer, or circumvent the platform’s security or controls;</li>
        <li>extract, copy, or disclose data except as required for your role; or</li>
        <li>use the platform in any way that breaches RTG policies or applicable law.</li>
      </ul>

      <h2>6. Confidentiality</h2>
      <p>
        Information within The Circle — including financial data, supplier details, and approval
        records — is confidential and the property of RTG. You must handle it in line with your
        confidentiality obligations and RTG’s information-security policies, both during and after
        your engagement with RTG.
      </p>

      <h2>7. Availability and changes</h2>
      <p>
        We aim to keep The Circle available and reliable but do not guarantee uninterrupted access.
        We may update, suspend, or withdraw features, and may revise these Terms from time to time.
        Where changes are material, we will make reasonable efforts to notify you. Continued use after
        changes take effect constitutes acceptance.
      </p>

      <h2>8. Termination</h2>
      <p>
        Your access is tied to your relationship with RTG and to your assigned permissions. RTG may
        suspend or revoke access at any time, including where these Terms or RTG policies are
        breached.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These Terms are governed by the laws of the Republic of Zimbabwe. Any dispute arising from
        your use of The Circle will be subject to the exclusive jurisdiction of the Zimbabwean courts.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these Terms can be raised with the RTG ICT / Finance Systems team through the
        in-app <strong>Report a Bug</strong> channel or your usual internal support contact.
      </p>
    </LegalLayout>
  );
}
