/**
 * Versioned legal documents — ToS + Privacy Policy.
 *
 * Edit `version` (or add a new row in the DB) when policies change.
 * Existing users will then be re-prompted on next stream attempt.
 *
 * Content stored inline (markdown) so the gate modal can render without a
 * separate CMS round-trip. Keep summaries under ~280 chars for readability
 * in the modal header.
 */

export const LEGAL_DOCUMENTS = [
  {
    type: 'tos' as const,
    version: '1.0',
    effectiveAt: new Date('2026-08-13T00:00:00Z'),
    summary:
      'Rules for using SIMP: 18+ only, no harassment or illegal content, your account can be terminated for violations, disputes resolved by binding arbitration.',
    content: `# SIMP Terms of Service

**Last updated:** August 13, 2026

These Terms of Service ("Terms") govern your access to and use of SIMP ("the Service"), operated by SIMP LLC ("we," "us," or "our"). By creating an account or using the Service, you agree to be bound by these Terms.

## 1. Eligibility

You must be at least **18 years of age** (or the age of majority in your jurisdiction, whichever is older) to use the Service. By using the Service, you represent and warrant that you meet this requirement.

## 2. Account Responsibilities

- You are responsible for maintaining the security of your account and password.
- You must provide accurate, current, and complete information during registration and keep it updated.
- You may not share your account credentials or allow others to access the Service through your account.
- You must notify us immediately of any unauthorized use of your account.

## 3. Acceptable Use

You agree **not** to:

- Post, upload, or stream any content that is illegal, harmful, threatening, abusive, harassing, defamatory, libelous, vulgar, obscene, or invasive of another's privacy.
- Impersonate any person or entity, or falsely state or otherwise misrepresent your affiliation with a person or entity.
- Upload or stream content that infringes any patent, trademark, trade secret, copyright, or other intellectual property right.
- Upload or stream content that depicts nudity, sexual activity, or pornography. **SIMP is a dating app, not an adult content platform** — flirty conversation is welcome; explicit content is not.
- Engage in spamming, phishing, or distributing malware.
- Solicit money, gifts, or financial information from other users (other than through SIMP's official paid features, if and when available).
- Use the Service for any commercial purpose not expressly approved by us.
- Attempt to circumvent rate limits, access controls, or security measures.

## 4. Live Streaming

- Live streams are recorded for safety, moderation, and quality purposes.
- We may terminate any live stream at any time at our sole discretion, including for violations of these Terms.
- Other users may report your stream; reports are reviewed by our moderation team.
- Streams may be capped at a maximum duration to ensure platform stability.

## 5. Content Ownership

- You retain ownership of content you create and upload.
- You grant us a worldwide, non-exclusive, royalty-free license to host, store, reproduce, modify (for technical purposes), publish, and display such content solely for the purpose of operating and improving the Service.
- You confirm you have all rights necessary to grant this license.

## 6. Termination

- You may terminate your account at any time by following the in-app instructions.
- We may suspend or terminate your account at any time, with or without notice, for conduct that we believe violates these Terms or is otherwise harmful to other users or the Service.
- Upon termination, your right to use the Service ceases immediately.

## 7. Disclaimers

The Service is provided **"as is"** and **"as available"** without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, secure, or error-free.

## 8. Limitation of Liability

To the maximum extent permitted by law, SIMP LLC shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.

## 9. Binding Arbitration & Class Action Waiver (US Users)

Any dispute arising from these Terms or your use of the Service shall be resolved by binding arbitration on an individual basis, not as a class action. You waive your right to a jury trial and to participate in any class, collective, or representative action.

**Opt-out:** You may opt out of this arbitration provision by sending written notice to legal@mysimp.com within 30 days of accepting these Terms.

## 10. Governing Law

These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict of law principles.

## 11. Changes to These Terms

We may update these Terms from time to time. If we make material changes, we will notify you through the Service and may require you to accept the updated Terms before continuing to use certain features. Your continued use of the Service after such notice constitutes acceptance of the updated Terms.

## 12. Contact

Questions about these Terms? Contact us at **legal@mysimp.com**.
`,
  },
  {
    type: 'privacy' as const,
    version: '1.0',
    effectiveAt: new Date('2026-08-13T00:00:00Z'),
    summary:
      'We collect account info, profile data, and usage analytics. We do not sell your data. You can request export or deletion at any time.',
    content: `# SIMP Privacy Policy

**Last updated:** August 13, 2026

This Privacy Policy explains how SIMP LLC ("we," "us," or "our") collects, uses, discloses, and protects your personal information when you use SIMP (the "Service").

## 1. Information We Collect

### 1a. Information You Provide

- **Account data:** email address, password (hashed), date of birth (for age verification).
- **Profile data:** display name, photos, bio, gender, location (city), occupation, height, interests.
- **Live stream content:** video, audio, chat messages, hearts/reactions.
- **Age confirmation:** the timestamp and IP address from which you confirmed you are 18+.
- **Legal acceptance:** timestamp and version of Terms of Service / Privacy Policy you accepted.

### 1b. Information Collected Automatically

- **Device data:** device type, operating system, browser version.
- **Usage analytics:** pages viewed, features used, approximate session duration.
- **Approximate location:** derived from your IP address (not precise GPS unless you grant explicit permission).

## 2. How We Use Your Information

We use your information to:

- Operate, maintain, and improve the Service.
- Verify your identity and age.
- Match you with other users.
- Moderate content, enforce our Terms, and protect the safety of our community.
- Communicate with you about the Service (updates, security alerts, support responses).
- Comply with legal obligations.

## 3. How We Share Your Information

We **do not sell** your personal information to third parties.

We may share information with:

- **Other users:** your profile data is visible to other users as part of the matching and discovery features.
- **Service providers:** vendors that help us operate the Service (hosting, analytics, customer support), bound by confidentiality and data-processing agreements.
- **Legal authorities:** when required by law, court order, or to protect the safety of our community.
- **Business transfers:** in the event of a merger, acquisition, or sale of assets.

## 4. Cookies and Tracking

We use a minimal set of cookies and local-storage mechanisms to keep you logged in, remember your preferences, and detect abuse. We do not use third-party advertising cookies or cross-site tracking.

## 5. Data Retention

We retain your account data for as long as your account is active. If you delete your account, we delete or anonymize your personal information within **30 days**, except where retention is required by law (e.g. tax records, fraud-prevention logs).

## 6. Your Rights

### 6a. GDPR (EU/EEA Users)

You have the right to:

- **Access** your personal data.
- **Rectify** inaccurate data.
- **Erase** your data ("right to be forgotten").
- **Restrict or object** to processing.
- **Data portability** — receive your data in a machine-readable format.
- **Withdraw consent** at any time.
- **Lodge a complaint** with your local data protection authority.

To exercise any of these rights, contact **privacy@mysimp.com**.

### 6b. CCPA / CPRA (California Users)

You have the right to:

- **Know** what personal information we collect and how we use it.
- **Delete** your personal information.
- **Opt out** of the sale or sharing of personal information (we do not sell).
- **Non-discrimination** for exercising your privacy rights.

To exercise these rights, contact **privacy@mysimp.com** or use the in-app "Download my data" / "Delete my account" controls.

### 6c. All Users

You can update most of your profile information directly in the app. For anything else, email **privacy@mysimp.com**.

## 7. Security

We use industry-standard measures to protect your information:

- Passwords hashed with bcrypt.
- TLS encryption in transit.
- Database encryption at rest (managed by our database provider).
- Access controls and audit logging.
- Regular security reviews.

No system is 100% secure. If you believe your account has been compromised, contact **security@mysimp.com** immediately.

## 8. Children

SIMP is not directed at children under 18. We do not knowingly collect personal information from anyone under 18. If we learn that we have, we delete it promptly.

## 9. International Data Transfers

We are based in the United States. If you use the Service from outside the US, your information will be transferred to and processed in the US. By using the Service, you consent to this transfer.

## 10. Changes to This Policy

We may update this Privacy Policy. If we make material changes, we will notify you through the Service and may require you to accept the updated policy before continuing to use certain features.

## 11. Contact

- **Privacy questions:** privacy@mysimp.com
- **Data deletion requests:** privacy@mysimp.com
- **Security issues:** security@mysimp.com
- **General support:** support@mysimp.com
`,
  },
];

export type LegalDocType = 'tos' | 'privacy';
