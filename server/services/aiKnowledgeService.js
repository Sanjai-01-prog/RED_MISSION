/**
 * RED MISSION — Grounded Knowledge Retrieval Service
 * Combines verified platform workflow knowledge with shared public data
 * (FAQ_ITEMS, BLOOD_GROUP_INVENTORY, DONATION_PILLARS, INSTITUTIONAL_ASSOCIATIONS)
 * so LLM responses never invent features, donor records, availability, or medical facts.
 */

import {
  FAQ_ITEMS,
  BLOOD_GROUP_INVENTORY,
  DONATION_PILLARS,
} from '../../src/data/missionData.js';
import { INSTITUTIONAL_ASSOCIATIONS } from '../../src/data/institutionalAssociations.js';

const WEBSITE_WORKFLOW_MODULES = [
  {
    id: 'user-auth',
    title: 'User Registration & Login',
    keywords: ['register', 'signup', 'sign up', 'login', 'otp', 'account', 'password', 'session', 'user', 'பதிவு', 'உள்நுழை', 'லாகின்'],
    content:
      'Users can create an account or sign in from the top Navbar "Login" button (role: User). ' +
      'Registration collects full name, mobile number, email, age, blood group, and city, verified via OTP. ' +
      'Sessions enforce security timeouts (30-minute inactivity and 24-hour maximum session duration).',
  },
  {
    id: 'donor-registration',
    title: 'Blood Donor Registration',
    keywords: ['donor', 'enlist', 'register as donor', 'become donor', 'selfie', 'photo', 'pincode', 'blood group', 'ரத்த தானம்', 'தானம் செய்', 'donor register', 'eppadi'],
    content:
      'To register as a blood donor on RED MISSION: first log in as a User, then open Donor Registration from your User Dashboard ("Register as Donor"). ' +
      'The form captures a live webcam selfie or uploaded donor photo (up to 3 MiB), residential pincode, optional last donation date, emergency alert consent, optional public donor directory listing consent, and photo visibility privacy preference.',
  },
  {
    id: 'donor-profile',
    title: 'Donor Profile Management & Cooldowns',
    keywords: ['profile', 'update', 'edit profile', 'cooldown', 'availability', 'hide photo', 'privacy', 'directory consent', 'dashboard', 'மாற்ற', 'சுயவிவரம்', 'update pannanum'],
    content:
      'Registered donors manage their profile inside the User Dashboard -> "Donor Profile" tab. ' +
      'They can update or replace their donor photo, toggle emergency alert availability, opt in or out of public Donor Directory visibility, and control whether their photo is publicly visible or kept private. ' +
      'Eligibility cooldown tracking enforces standard recovery windows (90 days for male whole-blood donors, 120 days for female whole-blood donors, and 14 days for Single Donor Platelets).',
  },
  {
    id: 'donor-directory',
    title: 'Donor Directory & Privacy Rules',
    keywords: ['find donor', 'search donor', 'directory', 'locate', 'nearby', 'contact donor', 'கண்டுபிடி', 'ரத்த கொடையாளர்', 'engae', 'theda'],
    content:
      'The Donor Directory allows finding compatible blood donors filtered by blood group and city without publicly exposing private phone numbers, emails, or unconsented photos. ' +
      'Only donors who explicitly opt in appear in public directory listings, identified safely using anonymized public donor references (DNR-...). Emergency dispatch alerts notify matched available donors without leaking personal contact records.',
  },
  {
    id: 'emergency-request',
    title: 'Emergency Blood Request Workflow',
    keywords: ['emergency', 'urgent', 'blood request', 'need blood', 'icu', 'hospital', 'patient', 'units', 'blood register', 'அவசரம்', 'உதவி', 'blood venum', 'request'],
    content:
      'To request emergency blood, open the "Blood Register" / "#requests" section on the website (or dashboard request tools) and submit a requisition with patient name, hospital name, city, required blood group (A+, A-, B+, B-, AB+, AB-, O+, O-), units requested, urgency level (CRITICAL, URGENT, STANDARD), contact person, and contact phone. ' +
      'In acute life-threatening emergencies in India, always call emergency medical services at 108 or Blood Helpline 104 immediately alongside posting a RED MISSION request.',
  },
  {
    id: 'donation-proof-certificates',
    title: 'Donation Proof Submission & Official Certificates',
    keywords: ['certificate', 'proof', 'receipt', 'slip', 'upload proof', 'qr', 'verify certificate', 'download', 'pdf', 'சான்றிதழ்', 'வாங்க', 'cert'],
    content:
      'After donating blood at a hospital, blood bank, or camp, open User Dashboard -> "Proofs" and upload your donation slip/certificate photo along with the donation center and date. ' +
      'RED MISSION Admins verify submitted proofs and issue an official digital Donation Certificate accessible under User Dashboard -> "Certificates". ' +
      'Each certificate contains a unique QR verification code that anyone can verify publicly via the QR verification view (#verify-certificate-...) and can be downloaded or printed as an A4 landscape PDF.',
  },
  {
    id: 'admin-superadmin',
    title: 'Admin & Super Admin Governance',
    keywords: ['admin', 'super admin', 'moderation', 'approve', 'verify proof', 'governance', 'monthly report', 'audit log', 'நிர்வாகி'],
    content:
      'RED MISSION has separate role-authenticated portals for Admins and Super Admins accessed via the role selection login flow. ' +
      'Admins review and verify donation proofs, oversee emergency blood requests, verify donors, issue certificates, and manage monthly reports. Super Admins oversee governance policies, admin teams, and audit logs. ' +
      'The AI assistant can explain these workflows but cannot perform admin actions or read/modify database records.',
  },
  {
    id: 'eligibility-compatibility',
    title: 'Eligibility Criteria & Blood Group Compatibility',
    keywords: ['eligible', 'eligibility', 'weight', 'age', 'hemoglobin', 'safe', 'infection', 'precaution', 'eat', 'drink', 'o-', 'o negative', 'ab+', 'ab positive', 'compatible', 'hypertension', 'diabetes', 'allergy', 'platelet', 'sdp', 'தகுதி', 'ரத்த வகை', 'வயது', 'எடை'],
    content:
      'Verified donor eligibility: healthy individuals aged 18–65 years, minimum weight 50 kg, minimum hemoglobin 12.5 g/dL, free from fever/active infections or major systemic illness. ' +
      'Whole blood interval: 90 days (males) / 120 days (females); SDP Platelets: every 14 days (max 24/year). ' +
      'All needles and collection bags are strictly sterile and single-use. Donation takes ~8–10 minutes (30 mins total); eat a light meal 2–3 hours beforehand, hydrate well, avoid alcohol 24h before, and avoid heavy lifting for 6h after. ' +
      'Well-controlled BP or non-insulin diabetes with normal day-of-donation vitals may qualify under screening physician clearance; wait 48 hours after finishing antibiotics. ' +
      'O- is the Universal Red Cell Donor (compatibleTo: All Blood Types); AB+ is the Universal Recipient and Universal Plasma Donor.',
  },
];

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s+-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

/**
 * Retrieves the most relevant verified RED MISSION knowledge chunks for a user message.
 */
export function retrieveRelevantKnowledge(query, history = []) {
  const combinedQuery = [
    String(query || ''),
    ...history.slice(-2).map((m) => String(m?.content || '')),
  ].join(' ');
  const qLower = combinedQuery.toLowerCase();
  const tokens = tokenize(combinedQuery);

  const scoredModules = WEBSITE_WORKFLOW_MODULES.map((mod) => {
    let score = 0;
    for (const kw of mod.keywords) {
      if (qLower.includes(kw.toLowerCase())) score += 5;
    }
    const haystack = `${mod.title} ${mod.content}`.toLowerCase();
    for (const tok of tokens) {
      if (haystack.includes(tok)) score += 1;
    }
    return { ...mod, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const scoredFaqs = FAQ_ITEMS.map((faq) => {
    let score = 0;
    const text = `${faq.category} ${faq.question} ${faq.answer}`.toLowerCase();
    for (const tok of tokens) {
      if (text.includes(tok)) score += 2;
    }
    return { ...faq, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const associationsSummary = INSTITUTIONAL_ASSOCIATIONS.map(
    (a) => `- ${a.name} (${a.subLabel})${a.type === 'internal-directory' ? ' -> #rotaract-directory' : a.url ? ` -> ${a.url}` : ''}`
  ).join('\n');

  const compatibilityLines = Object.entries(BLOOD_GROUP_INVENTORY)
    .map(
      ([group, info]) =>
        `- ${group}: can donate red cells to [${info.compatibleTo.join(', ')}]; can receive from [${info.receiveFrom.join(', ')}]`
    )
    .join('\n');

  const pillarLines = DONATION_PILLARS.map((p) => `- ${p.title}: ${p.description}`).join('\n');

  return {
    modules: scoredModules,
    faqs: scoredFaqs,
    associationsSummary,
    compatibilityLines,
    pillarLines,
  };
}

/**
 * Builds the grounded system prompt sent only from backend to the LLM provider.
 */
export function buildAiSystemPrompt(latestUserQuery, conversationHistory = []) {
  const retrieved = retrieveRelevantKnowledge(latestUserQuery, conversationHistory);

  const workflowContext = retrieved.modules
    .map((m) => `### ${m.title}\n${m.content}`)
    .join('\n\n');

  const faqContext = retrieved.faqs
    .map((f) => `Q (${f.category}): ${f.question}\nA: ${f.answer}`)
    .join('\n\n');

  return [
    'You are RED MISSION AI, the official helpful blood donation and platform assistant for the RED MISSION Blood Donation Management & Emergency Donor Network (hosted with KPRIET, Rotary, Rotaract District 3206, Rotaract KPRIET, and NSS KPRIET).',
    '',
    'CRITICAL RULES:',
    '1. Ground every platform answer STRICTLY in the verified RED MISSION facts provided below. Never invent website buttons, routes, donor names, phone numbers, blood bank stock counts, real-time unit numbers, admin actions, or medical diagnoses.',
    '2. LANGUAGE MATCHING: Detect whether the user writes in English, Tamil (தமிழ் script), or Tanglish (Tamil written in Latin letters like "epdi register pannanum", "blood donate panna eligibility enna", "help venum"), and reply fluently in that same language/style with warmth, clarity, and accuracy.',
    '3. UNCONFIRMED INFORMATION: If the user asks about live database records (e.g., private donor phone numbers, live local hospital stock levels, their personal OTP/account status, or topics unrelated to RED MISSION / voluntary blood donation), clearly state that verified information is unavailable in the assistant and direct them to the appropriate RED MISSION page (e.g., Donor Directory, Blood Register / #requests, or User Dashboard).',
    '4. SAFETY & MEDICAL BOUNDARY: Never provide medical diagnosis or replace a qualified physician or blood bank screening doctor. For acute medical or trauma emergencies in India, advise calling 108 / 104 immediately alongside raising an emergency request on RED MISSION.',
    '5. PRIVACY & SECURITY: Never claim you can execute admin actions, alter donor database records, issue certificates, or bypass authentication.',
    '6. STYLE: Keep answers concise, structured (short bullet points where helpful), empathetic, and easy to read on desktop and mobile.',
    '',
    '=== VERIFIED RED MISSION WORKFLOWS ===',
    workflowContext,
    '',
    '=== VERIFIED RED MISSION FAQS ===',
    faqContext,
    '',
    '=== BLOOD GROUP COMPATIBILITY ===',
    retrieved.compatibilityLines,
    '',
    '=== BLOOD DONATION SERVICES ===',
    retrieved.pillarLines,
    '',
    '=== INSTITUTIONAL & COMMUNITY ASSOCIATIONS ===',
    retrieved.associationsSummary,
  ].join('\n');
}
