/**
 * RED MISSION — Official Platform Terms & Conditions and Privacy Policy
 * Version 1.0.0 (Effective November 2026)
 * 
 * Strict alignment with Indian Digital Personal Data Protection (DPDP) Act,
 * National Blood Transfusion Council (NBTC) guidelines, and clinical network ethics.
 */

export const TERMS_VERSION = '1.0.0';
export const PRIVACY_POLICY_VERSION = '1.0.0';

export const RED_MISSION_TERMS = {
  version: TERMS_VERSION,
  lastUpdated: 'November 2026',
  title: 'RED MISSION — TERMS & CONDITIONS',
  subtitle: 'Terms of Use, Voluntary Donor Code, and Citizen Participation Guidelines',
  sections: [
    {
      number: '1',
      title: 'Acceptance of Terms',
      content:
        'By creating an account, registering as a voluntary blood donor, or submitting an emergency blood request on the RED MISSION platform, you explicitly acknowledge and agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not create an account or use our voluntary coordination services.'
    },
    {
      number: '2',
      title: 'Account Registration and Eligibility',
      content:
        'You must be at least 18 years of age to register an independent account on RED MISSION. To enlist as an active blood donor, you must meet basic physiological readiness standards established by the National Blood Transfusion Council (NBTC) of India, including being between 18 and 65 years old, having a minimum body weight of 45 kg (or 55 kg for 450 mL collection), and maintaining good health on the day of donation.'
    },
    {
      number: '3',
      title: 'Accuracy of Personal Information',
      content:
        'You certify that all information submitted during registration—including your legal name, mobile number, email address, age, blood group, city, and donor verification photograph—is true, accurate, and current. Submitting false identity information, fictitious medical claims, or another individual\'s credentials constitutes a serious violation of community trust and platform integrity.'
    },
    {
      number: '4',
      title: 'Personal Data Collection and Usage',
      content:
        'RED MISSION collects and processes personal information strictly for the humanitarian purpose of coordinating voluntary blood donations and managing hospital emergency requests. Your mobile number and email are verified via two-factor One-Time Passwords (OTPs). Contact details are never sold, rented, or distributed to commercial third parties or advertisers.'
    },
    {
      number: '5',
      title: 'Blood Donor Eligibility and Medical Assessment',
      content:
        'RED MISSION serves solely as an emergency communication and matching facilitator. Enlistment on RED MISSION does not replace, waive, or diminish clinical pre-donation screening. Before every donation, certified medical staff at licensed blood banks and hospital blood centres independently verify your hemoglobin (minimum 12.5 g/dL), blood pressure, pulse, temperature, and medical history. The hospital or blood centre holds sole medical authority to determine final eligibility.'
    },
    {
      number: '6',
      title: 'Donation Request and Coordination',
      content:
        'Emergency blood requests may be submitted by authorized healthcare administrators or registered citizens on behalf of verified hospital patients. Request creators warrant that requests represent genuine, urgent clinical requirements. Pledging to donate blood is a voluntary moral commitment; if you cannot fulfill a confirmed pledge, you must promptly cancel the pledge through your User Dashboard to release the reservation for another lifesaver.'
    },
    {
      number: '7',
      title: 'Communication and Notifications',
      content:
        'By registering, you consent to receive critical transactional communications, including SMS/email OTPs, urgent blood requisition alerts matching your blood group within your geographic vicinity, pledge status updates, and administrative security notices. You may manage emergency dispatch availability and notification preferences in your Donor Profile settings.'
    },
    {
      number: '8',
      title: 'Account Security and User Responsibilities',
      content:
        'You are solely responsible for maintaining the confidentiality of your login credentials and for all activities conducted under your authenticated account. You agree to notify RED MISSION administrators immediately of any unauthorized account access or suspected security compromise.'
    },
    {
      number: '9',
      title: 'Prohibited Activities and Misuse',
      content:
        'Users are strictly prohibited from: (a) requesting or offering monetary compensation, gifts, or financial incentives in exchange for blood donations (prohibited under the Drugs and Cosmetics Act and Indian legal frameworks); (b) creating fraudulent or hoax emergency requisitions; (c) harassing, spamming, or soliciting other users; and (d) attempting to circumvent authentication, scrape protected data, or disrupt platform infrastructure.'
    },
    {
      number: '10',
      title: 'Privacy and Data Protection',
      content:
        'Your privacy is safeguarded by strict technical and administrative controls. Donor profile photographs and directory listings remain private by default unless you choose to enable public discovery. All personal data handling complies with our Privacy Policy and applicable data protection laws. You maintain the right to review your data, update preferences, or request permanent account deletion at any time.'
    },
    {
      number: '11',
      title: 'Limitation of Platform Responsibilities',
      content:
        'RED MISSION is an open-source, non-profit community coordination network initiated by students and faculty of KPR Institute of Engineering and Technology (KPRIET) and Rotaract District 3206. RED MISSION does not own or operate physical blood storage facilities, blood transport ambulances, or clinical laboratories. We do not guarantee immediate donor availability or blood unit stock for every request, and cannot be held liable for clinical outcomes resulting from independent hospital procedures.'
    },
    {
      number: '12',
      title: 'Changes to Terms',
      content:
        'RED MISSION reserves the right to revise these Terms & Conditions to reflect platform improvements, legal requirements, or updated medical guidelines. When material changes are made, the version number and last updated date will be updated, and registered users will be notified upon login to review and re-confirm acceptance.'
    },
    {
      number: '13',
      title: 'Contact and Support',
      content:
        'For inquiries regarding these Terms & Conditions, privacy concerns, or platform assistance, you may contact the RED MISSION administration team through the Rotaract Club of KPRIET Blood Donor Desk or via email at support@redmission.org.'
    }
  ]
};

export const RED_MISSION_PRIVACY_POLICY = {
  version: PRIVACY_POLICY_VERSION,
  lastUpdated: 'November 2026',
  title: 'RED MISSION — PRIVACY POLICY',
  subtitle: 'How we collect, verify, secure, and respect your personal and clinical data',
  sections: [
    {
      title: '1. Information We Collect',
      content:
        'We collect information necessary to facilitate voluntary blood donation and emergency matching: (a) Identity & contact details (full name, verified mobile number, verified email address); (b) Biological & clinical metadata (blood group, age, city/locality, self-reported last donation date); (c) Voluntary donor verification photographs (captured with consent to prevent impersonation); and (d) Donation proof receipts and certificates.'
    },
    {
      title: '2. Purpose of Processing',
      content:
        'Your data is processed strictly for: (a) authenticating your account and preventing unauthorized access; (b) notifying you of emergency blood shortages matching your blood type; (c) coordinating with hospital blood centres; (d) issuing accredited lifesaver honors certificates; and (e) maintaining transparent, non-commercial platform metrics.'
    },
    {
      title: '3. Data Security and Access Controls',
      content:
        'All data is encrypted in transit using industry-standard TLS and secured at rest using salted cryptographic hashes (PBKDF2/SHA-256) for passwords and authentication tokens. Database access is strictly governed by Role-Based Access Controls (RBAC). Passwords, raw OTPs, and private session credentials are never stored in plain text.'
    },
    {
      title: '4. Sharing and Disclosure',
      content:
        'We never sell, rent, monetize, or share your personal data with commercial advertisers, brokers, or data brokers. Personal details are shared only with certified healthcare staff or emergency requesters when a voluntary donor explicitly accepts and confirms an active blood pledge.'
    },
    {
      title: '5. User Rights & Account Deletion',
      content:
        'You have the complete right to access, rectify, or export your personal information. You may deactivate or permanently delete your account at any time through your User Dashboard. Upon account deletion, personal identifiers and photographs are permanently scrubbed from active storage, retaining only anonymized statistical counts required for public health audits.'
    },
    {
      title: '6. Privacy Inquiries',
      content:
        'For privacy-related inquiries, data access requests, or regulatory questions under the Digital Personal Data Protection Act, contact the RED MISSION Data Governance Desk at privacy@redmission.org.'
    }
  ]
};
