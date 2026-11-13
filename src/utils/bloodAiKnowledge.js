import { FAQ_ITEMS } from '../data/missionData.js';

/**
 * Reusable semantic & retrieval metadata keyed by the canonical FAQ question
 * in src/data/missionData.js (FAQ_ITEMS). Keeping the canonical question/answer
 * text in missionData.js avoids duplicating FAQ records while giving Blood AI
 * natural-language matching and RED MISSION section guidance.
 */
const FAQ_RETRIEVAL_METADATA = {
  'Who is eligible to donate blood on RED MISSION?': {
    id: 'faq-eligibility',
    aliases: [
      'eligibility criteria for blood donation',
      'who can donate blood',
      'am i eligible to donate',
      'minimum age and weight to donate',
      'hemoglobin requirement for blood donation',
      'can i donate blood'
    ],
    keywords: [
      'eligible', 'eligibility', 'criteria', 'qualify', 'requirement', 'requirements',
      'age', '18', '65', 'weight', '50', 'kg', 'hemoglobin', 'hb', '12.5', 'healthy',
      'fever', 'illness', 'infection'
    ],
    linkText: 'View Donor Profile & Eligibility',
    linkHref: '#user-dashboard'
  },
  'How often can I donate blood or platelets?': {
    id: 'faq-frequency',
    aliases: [
      'how often can i donate single donor platelets',
      'how many days between blood donations',
      'donation cooldown period',
      'gap between donations',
      'how frequently can men or women donate',
      'when can i donate again'
    ],
    keywords: [
      'often', 'frequency', 'frequently', 'interval', 'cooldown', 'gap', 'days',
      '90', '120', '14', '24', 'months', 'whole', 'platelet', 'platelets', 'sdp',
      'apheresis', 'male', 'female', 'women', 'men', 'again', 'year'
    ],
    linkText: 'Explore Donation Journey',
    linkHref: '#journey'
  },
  'Is it completely safe to donate blood? Can I contract an infection?': {
    id: 'faq-safety',
    aliases: [
      'is donating blood safe',
      'can i catch hiv or hepatitis from donating',
      'are needles reused',
      'risk of infection when donating blood',
      'sterile needle safety'
    ],
    keywords: [
      'safe', 'safety', 'contract', 'catch', 'infection', 'infections', 'virus',
      'hiv', 'hepatitis', 'needle', 'needles', 'sterile', 'single-use', 'disposable',
      'tubing', 'bag', 'risk', 'impossible'
    ],
    linkText: 'View Clinical Safety Steps',
    linkHref: '#journey'
  },
  'How long does the donation process take, and will it weaken me?': {
    id: 'faq-duration-weakness',
    aliases: [
      'how much time does donating blood take',
      'will blood donation make me weak',
      'how long to recover after donating blood',
      'can i go back to work after donating',
      'does donating blood cause weakness or dizziness'
    ],
    keywords: [
      'long', 'time', 'duration', 'minutes', '30', '8', '10', 'hours', 'weaken',
      'weak', 'weakness', 'tired', 'fatigue', 'dizzy', 'replenish', 'fluid',
      '450ml', 'work', 'resume', 'process', 'recovery'
    ],
    linkText: 'View Step-by-Step Process',
    linkHref: '#journey'
  },
  'What precautions should I take before and after donating blood?': {
    id: 'faq-precautions',
    aliases: [
      'what should i eat before donating blood',
      'can i drink alcohol before blood donation',
      'before and after donation guidelines',
      'how to prepare for blood donation',
      'post donation care and lifting',
      'should i fast before donating blood'
    ],
    keywords: [
      'precaution', 'precautions', 'prepare', 'preparation', 'guideline', 'guidelines',
      'before', 'after', 'eat', 'meal', 'breakfast', 'fast', 'fasting', 'water',
      '500ml', 'hydrate', 'hydrated', 'alcohol', 'rest', '15', 'juice', 'snacks',
      'lifting', 'heavy', 'exercise', 'strenuous', 'care'
    ],
    linkText: 'View Donation Guidelines',
    linkHref: '#journey'
  },
  'Why are O-negative and AB-positive blood groups unique?': {
    id: 'faq-blood-groups',
    aliases: [
      'what is a universal donor',
      'what is a universal recipient',
      'why is o negative blood special',
      'why is ab positive unique',
      'blood type compatibility rules',
      'which blood group can donate to anyone'
    ],
    keywords: [
      'o-negative', 'o negative', 'o-', 'ab-positive', 'ab positive', 'ab+',
      'universal', 'donor', 'recipient', 'plasma', 'antigen', 'antigens',
      'antibody', 'antibodies', 'unique', 'compatibility', 'compatible',
      'blood group', 'blood groups', 'blood type', 'blood types'
    ],
    linkText: 'Open Blood Group Matrix',
    linkHref: '#telemetry'
  },
  'How does RED MISSION verify donation proof and issue certificates?': {
    id: 'faq-proof-certificates',
    aliases: [
      'how do i get my donation certificate',
      'how to upload donation proof',
      'how are donation slips verified',
      'qr verification code on certificate',
      'where do i submit my hospital donation receipt'
    ],
    keywords: [
      'verify', 'verification', 'proof', 'certificate', 'certificates', 'slip',
      'receipt', 'upload', 'admin', 'qr', 'digital', 'authentic', 'issue', 'issued',
      'hospital', 'camp', 'bank', 'cross-verify'
    ],
    linkText: 'Open User Dashboard (Proofs & Certificates)',
    linkHref: '#user-dashboard'
  },
  'How quickly can I find a donor in an emergency?': {
    id: 'faq-emergency-speed',
    aliases: [
      'how fast can i get blood in an emergency',
      'emergency blood request response time',
      'how are nearby donors alerted',
      'urgent blood matching speed',
      'submit emergency blood request'
    ],
    keywords: [
      'quickly', 'fast', 'quick', 'speed', 'response', 'emergency', 'urgent',
      'minutes', 'seconds', '15', 'match', 'matching', 'nearby', 'radius',
      'geo-radius', 'sms', 'whatsapp', 'push', 'alert', 'alerts', 'request',
      'requests', 'find'
    ],
    linkText: 'Open Emergency Blood Register',
    linkHref: '#requests'
  },
  'What is Blood Drop and how does the voice assistant work?': {
    id: 'faq-blood-drop',
    aliases: [
      'what is blood drop ai',
      'how does blood ai voice assistant work',
      'what can i ask blood drop',
      'how to use voice commands on red mission'
    ],
    keywords: [
      'blood drop', 'blood ai', 'assistant', 'voice', 'speak', 'speech',
      'voice-first', 'command', 'commands', 'paracetamol', 'mic', 'microphone',
      'synthesized', 'work'
    ],
    linkText: null,
    linkHref: null
  },
  'Can I donate if I have hypertension, diabetes, or mild allergies?': {
    id: 'faq-medical-conditions',
    aliases: [
      'can a diabetic donate blood',
      'can i donate with high blood pressure',
      'blood donation with bp or sugar',
      'can i donate on oral diabetes medication or insulin',
      'can i donate if i have allergies or take antibiotics'
    ],
    keywords: [
      'hypertension', 'blood pressure', 'bp', 'diabetes', 'diabetic', 'sugar',
      'insulin', 'oral', 'medication', 'medications', 'medicine', 'allergy',
      'allergies', 'mild', 'seasonal', 'antibiotic', 'antibiotics', '48',
      'hours', 'vitals', 'condition', 'conditions'
    ],
    linkText: 'Review Donor Eligibility',
    linkHref: '#journey'
  }
};

// Public-safe operational guidance entries for existing Blood Drop voice prompts
// (without exposing private user, donor, or emergency request records).
const PLATFORM_GUIDANCE_ITEMS = [
  {
    id: 'guide-o-negative-search',
    category: 'Emergency Requests',
    question: 'Find O-negative donors nearby in Mumbai',
    answer:
      'For donor privacy, RED MISSION does not disclose private donor details through AI chat. Submit an emergency blood request in the Emergency Blood Register so nearby compatible O-negative donors can be alerted automatically, or call the 24/7 National Emergency Blood Helpline at 108 / 104.',
    aliases: ['find o- donors', 'search compatible donors nearby', 'locate o negative donors'],
    keywords: ['mumbai', 'nearby', 'locate', 'search', 'o-', 'o-negative', 'donors'],
    linkText: 'Open Emergency Blood Register',
    linkHref: '#requests',
    isFaq: false
  },
  {
    id: 'guide-submit-request',
    category: 'Emergency Requests',
    question: 'Submit emergency blood request for B+ blood',
    answer:
      'You can post an urgent patient blood requisition in the Emergency Blood Register section (#requests). Once submitted, RED MISSION matches and alerts nearby compatible donors automatically. For immediate trauma assistance, call 108 / 104.',
    aliases: ['post blood request', 'request b+ blood', 'create urgent requisition'],
    keywords: ['submit', 'post', 'requisition', 'b+', 'patient', 'emergency', 'request'],
    linkText: 'Post Emergency Requisition',
    linkHref: '#requests',
    isFaq: false
  },
  {
    id: 'guide-donation-camps',
    category: 'Preparation & Guidelines',
    question: 'Where is the nearest blood donation camp this weekend?',
    answer:
      'RED MISSION connects with hospital blood banks and community donation drives. Check the Emergency Blood Register and platform updates for active drives, or ask about donor eligibility, preparation, and safety guidelines before donating.',
    aliases: ['nearest blood donation camp', 'upcoming blood drive this weekend'],
    keywords: ['camp', 'camps', 'drive', 'drives', 'weekend', 'nearest', 'venue'],
    linkText: 'View Platform Updates',
    linkHref: '#requests',
    isFaq: false
  }
];

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'they', 'their', 'it', 'its',
  'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'as', 'into',
  'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this', 'these', 'those',
  'can', 'could', 'will', 'would', 'should', 'shall', 'may', 'might', 'must',
  'do', 'does', 'did', 'have', 'has', 'had', 'what', 'which', 'who', 'whom',
  'when', 'where', 'why', 'how', 'tell', 'please', 'explain', 'about', 'any',
  'there', 'need', 'want', 'know', 'get'
]);

const SYNONYM_REPLACEMENTS = [
  [/\bhigh blood pressure\b/g, 'hypertension bp'],
  [/\bblood pressure\b/g, 'hypertension bp'],
  [/\bhigh bp\b/g, 'hypertension bp'],
  [/\bsugar\b/g, 'diabetes'],
  [/\bdiabetic\b/g, 'diabetes'],
  [/\bhaemoglobin\b/g, 'hemoglobin'],
  [/\bhb\b/g, 'hemoglobin'],
  [/\bo[\s-]*negative\b/g, 'o-negative o-'],
  [/\bo[\s-]*neg\b/g, 'o-negative o-'],
  [/\bab[\s+]*positive\b/g, 'ab-positive ab+'],
  [/\bab[\s+]*pos\b/g, 'ab-positive ab+'],
  [/\bsingle donor platelets?\b/g, 'sdp platelet platelets apheresis'],
  [/\bsdp\b/g, 'sdp platelet platelets apheresis'],
  [/\bcooldown\b/g, 'often interval gap'],
  [/\bfrequently\b/g, 'often frequency'],
  [/\bfrequency\b/g, 'often frequency'],
  [/\bdonating\b/g, 'donate'],
  [/\bdonated\b/g, 'donate'],
  [/\bdonation\b/g, 'donate'],
  [/\bvaccinations?\b/g, 'vaccine'],
  [/\binfections?\b/g, 'infection'],
  [/\bcatch\b/g, 'contract infection'],
  [/\bweakness\b/g, 'weaken weak'],
  [/\btired\b/g, 'weaken weak'],
  [/\bdizzy\b/g, 'weaken weak'],
  [/\bcertificates?\b/g, 'certificate'],
  [/\breceipts?\b/g, 'receipt slip proof'],
  [/\bslips?\b/g, 'slip proof'],
  [/\bverified\b/g, 'verify verification'],
  [/\ballergies\b/g, 'allergy allergies'],
  [/\ballergic\b/g, 'allergy allergies'],
  [/\bmedicines?\b/g, 'medication medicine'],
  [/\btablets?\b/g, 'medication'],
  [/\bprepare\b/g, 'precaution preparation'],
  [/\bpreparing\b/g, 'precaution preparation'],
  [/\bfood\b/g, 'meal eat precaution'],
  [/\beat\b/g, 'meal eat precaution'],
  [/\bdrink\b/g, 'water hydrate alcohol precaution'],
  [/\bfast\b/g, 'fasting quickly fast']
];

function normalizeText(text) {
  let normalized = String(text || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9+\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of SYNONYM_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

function tokenize(text) {
  const norm = normalizeText(text);
  if (!norm) return [];
  return Array.from(
    new Set(
      norm
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
    )
  );
}

function tokenMatchScore(queryToken, targetTokens) {
  if (targetTokens.has(queryToken)) return 1;
  if (queryToken.length >= 4) {
    for (const target of targetTokens) {
      if (target.length >= 4 && (target.startsWith(queryToken) || queryToken.startsWith(target))) {
        return 0.75;
      }
    }
  }
  return 0;
}

/**
 * Canonical FAQ items enriched with retrieval metadata, preserving the original
 * FAQ_ITEMS from missionData.js as the single source of truth.
 */
export const BLOOD_AI_FAQ_KNOWLEDGE = FAQ_ITEMS.map((faq, index) => {
  const meta = FAQ_RETRIEVAL_METADATA[faq.question] || {};
  return {
    id: meta.id || `faq-${index + 1}`,
    category: faq.category,
    question: faq.question,
    answer: faq.answer,
    aliases: meta.aliases || [],
    keywords: meta.keywords || [],
    linkText: meta.linkText ?? null,
    linkHref: meta.linkHref ?? null,
    isFaq: true
  };
});

/**
 * Ordered list of FAQ categories preserved from the original FAQ section.
 */
export const BLOOD_AI_CATEGORIES = Array.from(
  new Set(BLOOD_AI_FAQ_KNOWLEDGE.map((item) => item.category))
);

const ALL_KNOWLEDGE_ITEMS = [...BLOOD_AI_FAQ_KNOWLEDGE, ...PLATFORM_GUIDANCE_ITEMS];

const PREPARED_INDEX = ALL_KNOWLEDGE_ITEMS.map((item) => {
  const normalizedQuestion = normalizeText(item.question);
  const normalizedAliases = item.aliases.map(normalizeText);
  const questionTokens = new Set(tokenize(item.question));
  const categoryTokens = new Set(tokenize(item.category));
  const keywordTokens = new Set(item.keywords.flatMap((k) => tokenize(k)));
  const answerTokens = new Set(tokenize(item.answer));

  return {
    item,
    normalizedQuestion,
    normalizedAliases,
    questionTokens,
    categoryTokens,
    keywordTokens,
    answerTokens
  };
});

export const BLOOD_AI_UNCONFIRMED_RESPONSE = {
  matched: false,
  source: 'unconfirmed',
  category: 'Unconfirmed Information',
  matchedQuestion: null,
  text:
    "I don't have confirmed information about that in RED MISSION's verified FAQ and clinical knowledge source. I can answer verified questions on donor eligibility, donation frequency, health & safety, before/after precautions, blood type compatibility, donation proof & certificates, and emergency request response times. For urgent medical guidance, please call the 24/7 National Emergency Blood Helpline at 108 / 104.",
  linkText: 'Open Emergency Blood Register',
  linkHref: '#requests'
};

/**
 * Query RED MISSION's Blood AI knowledge source.
 * Prioritizes verified FAQ_ITEMS and returns an explicit unconfirmed notice
 * when the user's question is outside the verified knowledge base.
 */
export function queryBloodAi(rawQuery) {
  const trimmed = String(rawQuery || '').trim();
  if (!trimmed) {
    return BLOOD_AI_UNCONFIRMED_RESPONSE;
  }

  const normalizedQuery = normalizeText(trimmed);
  const queryTokens = tokenize(trimmed);

  // Exact match check on original FAQ question first (highest priority)
  const exactFaq = PREPARED_INDEX.find(
    (entry) => entry.item.isFaq && entry.normalizedQuestion === normalizedQuery
  );
  if (exactFaq) {
    return {
      matched: true,
      source: 'faq',
      confidence: 1,
      category: exactFaq.item.category,
      matchedQuestion: exactFaq.item.question,
      text: exactFaq.item.answer,
      linkText: exactFaq.item.linkText,
      linkHref: exactFaq.item.linkHref
    };
  }

  // Exact match check on platform guidance prompts
  const exactGuide = PREPARED_INDEX.find(
    (entry) => !entry.item.isFaq && entry.normalizedQuestion === normalizedQuery
  );
  if (exactGuide) {
    return {
      matched: true,
      source: 'platform-guidance',
      confidence: 1,
      category: exactGuide.item.category,
      matchedQuestion: exactGuide.item.question,
      text: exactGuide.item.answer,
      linkText: exactGuide.item.linkText,
      linkHref: exactGuide.item.linkHref
    };
  }

  if (queryTokens.length === 0) {
    return BLOOD_AI_UNCONFIRMED_RESPONSE;
  }

  let bestEntry = null;
  let bestScore = 0;

  for (const entry of PREPARED_INDEX) {
    let score = 0;

    // 1. Alias phrase matching
    for (const alias of entry.normalizedAliases) {
      if (normalizedQuery === alias) {
        score += 90;
      } else if (normalizedQuery.includes(alias) || alias.includes(normalizedQuery)) {
        if (normalizedQuery.length >= 10) score += 28;
      }
    }

    // 2. Token-level weighted semantic scoring
    let keywordHits = 0;
    let questionHits = 0;
    let answerHits = 0;

    for (const qTok of queryTokens) {
      const qMatch = tokenMatchScore(qTok, entry.questionTokens);
      const kMatch = tokenMatchScore(qTok, entry.keywordTokens);
      const cMatch = tokenMatchScore(qTok, entry.categoryTokens);
      const aMatch = tokenMatchScore(qTok, entry.answerTokens);

      if (qMatch > 0) {
        score += 7 * qMatch;
        questionHits += qMatch;
      }
      if (kMatch > 0) {
        score += 6 * kMatch;
        keywordHits += kMatch;
      }
      if (cMatch > 0) {
        score += 3 * cMatch;
      }
      if (aMatch > 0) {
        score += 2 * aMatch;
        answerHits += aMatch;
      }
    }

    // Boost verified FAQs slightly over generic guidance when tied
    if (entry.item.isFaq && (questionHits > 0 || keywordHits > 0)) {
      score += 1.5;
    }

    // Require meaningful signal: at least one question or keyword hit (not just stray answer words)
    const meaningfulHits = questionHits + keywordHits;
    const coverage = (questionHits + keywordHits + answerHits * 0.5) / queryTokens.length;

    if (meaningfulHits >= 1 && coverage >= 0.35 && score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  // Minimum confidence threshold prevents hallucinated/forced matches on unrelated questions
  if (!bestEntry || bestScore < 10) {
    return BLOOD_AI_UNCONFIRMED_RESPONSE;
  }

  return {
    matched: true,
    source: bestEntry.item.isFaq ? 'faq' : 'platform-guidance',
    confidence: Math.min(1, Number((bestScore / 30).toFixed(2))),
    category: bestEntry.item.category,
    matchedQuestion: bestEntry.item.question,
    text: bestEntry.item.answer,
    linkText: bestEntry.item.linkText,
    linkHref: bestEntry.item.linkHref
  };
}
