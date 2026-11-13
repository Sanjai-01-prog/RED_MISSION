// RED MISSION — BLOOD DONATION MANAGEMENT & EMERGENCY DONOR NETWORK
// Core platform data: Navigation, Real-time Blood Telemetry, Donors, Requests, Camps, Lifeline Roadmap, and FAQs.

export const NAVIGATION_LINKS = [
  { name: 'Home', href: '#home' },
  { name: 'Blood Requests', href: '#requests' },
];

export const BLOOD_NETWORK_TELEMETRY = {
  unitsCollectedToday: 1482,
  activeEmergencyRequests: 24,
  registeredDonors: 48250,
  livesSaved: 144750,
  avgResponseMinutes: 14.8,
  bloodBanksConnected: 186,
  universalDonorsAvailable: 3840,
  coldChainAvgTemp: 3.8, // Celsius (optimal 2°C to 6°C)
  plateletUnitsReady: 412,
  plasmaLitersFrozen: 890,
  networkDispatchEfficiency: 99.4,
  criticalBloodGroups: ['O-', 'AB-', 'B-']
};

export const BLOOD_GROUP_INVENTORY = {
  'A+': { units: 420, status: 'Adequate', demand: 'Moderate', compatibleTo: ['A+', 'AB+'], receiveFrom: ['A+', 'A-', 'O+', 'O-'] },
  'A-': { units: 115, status: 'Low', demand: 'High', compatibleTo: ['A+', 'A-', 'AB+', 'AB-'], receiveFrom: ['A-', 'O-'] },
  'B+': { units: 510, status: 'Adequate', demand: 'High', compatibleTo: ['B+', 'AB+'], receiveFrom: ['B+', 'B-', 'O+', 'O-'] },
  'B-': { units: 98, status: 'Critical', demand: 'Very High', compatibleTo: ['B+', 'B-', 'AB+', 'AB-'], receiveFrom: ['B-', 'O-'] },
  'AB+': { units: 230, status: 'Adequate', demand: 'Universal Recipient', compatibleTo: ['AB+'], receiveFrom: ['All Blood Types'] },
  'AB-': { units: 64, status: 'Critical', demand: 'High', compatibleTo: ['AB+', 'AB-'], receiveFrom: ['AB-', 'A-', 'B-', 'O-'] },
  'O+': { units: 680, status: 'Adequate', demand: 'High', compatibleTo: ['O+', 'A+', 'B+', 'AB+'], receiveFrom: ['O+', 'O-'] },
  'O-': { units: 180, status: 'Urgent Need', demand: 'Universal Donor', compatibleTo: ['All Blood Types'], receiveFrom: ['O- Only'] },
};

export const DONATION_PILLARS = [
  {
    id: 'whole-blood',
    code: 'SRV-01',
    title: 'Whole Blood Collection & Separation',
    category: 'Essential Supply',
    description: 'Standard 450ml whole blood collection separated into Red Blood Cells, Platelets, and Cryoprecipitate—a single donation can save up to 3 individual lives.',
    stats: { volume: '450 ml', shelfLife: '42 Days', storageTemp: '2°C to 6°C' },
    icon: 'Droplet',
    badge: 'Core Lifeline',
    detailedSpecs: {
      subsystem: 'Centrifugal Fractionation System (Triple-Bag Sterile Manifold)',
      hardware: 'Automated blood collection mixers with precise optical flow and weight cutoffs.',
      redundancy: 'Dual serological testing panels for HIV I/II, Hep B (HBsAg), Hep C, Syphilis, and Malaria.',
      flightHeritage: 'Over 1.2M successful transfusions verified through accredited hospital blood banks.',
      partner: 'National Blood Transfusion Council // Red Cross Society'
    }
  },
  {
    id: 'platelet-apheresis',
    code: 'SRV-02',
    title: 'Platelet Apheresis (SDP)',
    category: 'Oncology & Trauma',
    description: 'Automated extraction of platelets while returning red blood cells to the donor. Crucial for cancer patients, acute leukemia treatment, and severe dengue hemorrhages.',
    stats: { yield: '3.0 x 10¹¹', shelfLife: '5 Days', storageTemp: '20°C to 24°C' },
    icon: 'Activity',
    badge: 'Critical Need',
    detailedSpecs: {
      subsystem: 'Single Donor Platelet (SDP) Continuous Flow Centrifuge',
      hardware: 'Automated apheresis separator with constant gentle agitation incubators.',
      redundancy: 'Bacterial contamination screen via BacT/ALERT microbial detection system.',
      flightHeritage: 'Provides therapeutic doses equivalent to 6 random donor platelet units.',
      partner: 'State Cancer Care Center // Hematology Directorate'
    }
  },
  {
    id: 'fresh-plasma',
    code: 'SRV-03',
    title: 'Fresh Frozen Plasma (FFP)',
    category: 'Critical Care',
    description: 'Rapidly frozen plasma rich in essential coagulation factors and albumin. Essential for massive trauma resuscitation, severe burn treatments, and liver disease therapy.',
    stats: { volume: '220 ml', shelfLife: '1 Year', storageTemp: '-30°C Deep Cryo' },
    icon: 'Shield',
    badge: 'Coagulation Support',
    detailedSpecs: {
      subsystem: 'Blast Freezer & Cryoprecipitate Extraction Loop',
      hardware: 'Ultra-low temperature mechanical blast freezers reaching -40°C within 60 minutes.',
      redundancy: 'Pathogen reduction technology utilizing riboflavin photochemical inactivation.',
      flightHeritage: 'Certified for major surgical trauma, hemophilia factor replacement, and shock management.',
      partner: 'Emergency Trauma & Critical Care Association'
    }
  },
  {
    id: 'rare-blood',
    code: 'SRV-04',
    title: 'Rare Blood Group Registry',
    category: 'Specialized Transfusion',
    description: 'Expedited matching network for rare phenotypes including Bombay Blood Group (hh), Rh-Null, Duffy-negative, and Kell-negative patients requiring immediate cross-matching.',
    stats: { registry: '2,400+ Donors', matchSpeed: '< 25 Mins', accuracy: '99.99%' },
    icon: 'Search',
    badge: 'High Priority',
    detailedSpecs: {
      subsystem: 'Phenotype Molecular Genotyping & Digital Crossmatching',
      hardware: 'Automated gel card agglutination analyzers and DNA PCR antigen typers.',
      redundancy: 'Decentralized national cold-storage network with reciprocal inter-state courier dispatch.',
      flightHeritage: 'Successfully mobilized Bombay Group blood across 8 critical pediatric cardiac surgeries.',
      partner: 'International Society of Blood Transfusion (ISBT) Rare Registry'
    }
  },
  {
    id: 'mobile-camps',
    code: 'SRV-05',
    title: 'Mobile Blood Drive Units',
    category: 'Community Outreach',
    description: 'Self-contained, air-conditioned mobile blood drive buses with 6 sterile donor couches, onboard cold storage, and emergency medical triage for corporate and college campuses.',
    stats: { fleetSize: '28 Coaches', capacity: '120 Units/Day', sterileGrade: 'ISO 14644' },
    icon: 'Truck',
    badge: 'Active Drives',
    detailedSpecs: {
      subsystem: 'Mobile Hemoculture Van with Onboard Generator & Inverter Backup',
      hardware: 'Hydraulic donor couches, refrigerated centrifuged transport boxes, and digital donor kiosks.',
      redundancy: 'Autonomous cellular GPS tracker + remote temperature logger syncing every 30 seconds.',
      flightHeritage: 'Conducted over 3,400 community blood donation camps collecting 280,000+ units.',
      partner: 'Rotary Blood Bank Federation // Youth Red Cross'
    }
  },
  {
    id: 'smart-cold-chain',
    code: 'SRV-06',
    title: 'Smart Cold-Chain IoT Transport',
    category: 'Logistics & Safety',
    description: 'IoT-monitored refrigerated smart transport pods maintaining strict 2°C to 6°C temperatures with continuous GPS tracking, shock detection, and temperature anomaly alerts.',
    stats: { tempHold: '36 Hours', variance: '± 0.2°C', telemetry: '5G Active IoT' },
    icon: 'Thermometer',
    badge: 'Active Logistics',
    detailedSpecs: {
      subsystem: 'Phase-Change Material (PCM) Insulated Vacuum Transit Box',
      hardware: 'Calibrated thermistor probe array, accelerometer tilt sensors, and cryptographic tamper seals.',
      redundancy: 'Instant SMS & automated rerouting if container temperature approaches 6.0°C threshold.',
      flightHeritage: 'Zero cold-chain breaches logged across 85,000 hospital dispatch deliveries.',
      partner: 'Smart Medical Supply Chain & Cold Chain Logistics Council'
    }
  },
  {
    id: 'drone-dispatch',
    code: 'SRV-07',
    title: 'Emergency Drone Blood Delivery',
    category: 'Emergency Dispatch',
    description: 'Autonomous long-range medical delivery drones flying blood and platelet units directly over urban traffic jams and remote rural hospitals in critical golden hour emergencies.',
    stats: { flightSpeed: '110 km/h', range: '85 km', dispatchTime: '< 3 Mins' },
    icon: 'Radio',
    badge: 'Rapid Response',
    detailedSpecs: {
      subsystem: 'Vertical Takeoff and Landing (VTOL) Medical Drone Platform',
      hardware: 'Fail-safe dual GPS navigation, parachute emergency landing system, and insulated aero-payload bay.',
      redundancy: 'Dual battery hot-swap with automated return-to-base if weather exceeds safe limits.',
      flightHeritage: 'Saved 214 trauma patients by cutting transit times from 2.5 hours to 18 minutes.',
      partner: 'Autonomous Air Medical Logistics // Civil Aviation Authority'
    }
  },
  {
    id: 'ai-matching',
    code: 'SRV-08',
    title: 'AI Compatibility & Geo-Matching',
    category: 'Digital Network',
    description: 'Machine learning algorithms that predict local blood shortages, instantly alert nearest compatible donors, and optimize route coordination during multi-casualty incidents.',
    stats: { matchLatency: '1.2 Secs', donorAlert: 'SMS + Push', radius: 'Dynamic 15km' },
    icon: 'Cpu',
    badge: 'AI Powered',
    detailedSpecs: {
      subsystem: 'Graph Neural Network (GNN) for Real-Time Donor Geo-Clustering',
      hardware: 'High-throughput cloud cluster with automated telephony and encrypted WhatsApp API gateway.',
      redundancy: 'Fallback to GSM SMS broadcast if internet data connectivity is disrupted.',
      flightHeritage: 'Achieved 82% donor response rate within 20 minutes for critical pediatric emergencies.',
      partner: 'AI for Healthcare Initiative // Public Health Foundation'
    }
  }
];

export const INITIAL_DONORS = [
  {
    id: 'dn-01',
    name: 'Dr. Rahul Sharma',
    bloodGroup: 'O-',
    city: 'Mumbai, Maharashtra',
    locality: 'Andheri West // Near Kokilaben Hospital',
    distanceKm: 2.4,
    phone: '+91 98201 44XXX',
    donationsCount: 14,
    lastDonationDate: '2026-07-12',
    isAvailable: true,
    badges: ['Universal Lifesaver', 'Platelet Hero', 'Verified Donor'],
    bio: 'Dedicated O-negative donor and trauma surgeon. Available 24/7 for pediatric and emergency cardiac calls.',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dn-02',
    name: 'Priya Narayanan',
    bloodGroup: 'B+',
    city: 'Bangalore, Karnataka',
    locality: 'Koramangala // Near St. John Hospital',
    distanceKm: 3.8,
    phone: '+91 94481 22XXX',
    donationsCount: 8,
    lastDonationDate: '2026-08-05',
    isAvailable: true,
    badges: ['Regular Donor', 'Platelet Donor', 'Verified Donor'],
    bio: 'Software architect passionate about community blood drives. Donating every 90 days like clockwork.',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dn-03',
    name: 'Arjun Verma',
    bloodGroup: 'A+',
    city: 'Delhi NCR',
    locality: 'Saket // Near Max Hospital',
    distanceKm: 5.1,
    phone: '+91 98110 55XXX',
    donationsCount: 11,
    lastDonationDate: '2026-06-20',
    isAvailable: true,
    badges: ['Century Lifesaver', 'Camp Volunteer', 'Verified Donor'],
    bio: 'University professor coordinating campus blood drives. Ready for whole blood and platelet apheresis.',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dn-04',
    name: 'Ananya Mukherjee',
    bloodGroup: 'AB-',
    city: 'Kolkata, West Bengal',
    locality: 'Salt Lake Sector 5 // Near AMRI',
    distanceKm: 4.2,
    phone: '+91 98302 77XXX',
    donationsCount: 6,
    lastDonationDate: '2026-09-02',
    isAvailable: true,
    badges: ['Rare Type Lifesaver', 'Plasma Donor', 'Verified Donor'],
    bio: 'AB-negative rare donor registered on the emergency response registry for thalassemia support.',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dn-05',
    name: 'Karthik Subbaraj',
    bloodGroup: 'O+',
    city: 'Chennai, Tamil Nadu',
    locality: 'Anna Nagar // Near Apollo Hospital',
    distanceKm: 1.8,
    phone: '+91 98403 99XXX',
    donationsCount: 19,
    lastDonationDate: '2026-07-28',
    isAvailable: true,
    badges: ['Star Donor', '15+ Club', 'Verified Donor'],
    bio: 'Runner and fitness instructor donating blood for 6 years. Firm believer that donating blood revitalizes health.',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'dn-06',
    name: 'Zoya Qureshi',
    bloodGroup: 'B-',
    city: 'Hyderabad, Telangana',
    locality: 'Banjara Hills // Near Care Hospital',
    distanceKm: 3.1,
    phone: '+91 97004 88XXX',
    donationsCount: 7,
    lastDonationDate: '2026-08-19',
    isAvailable: true,
    badges: ['Rare Group Star', 'Emergency Responder', 'Verified Donor'],
    bio: 'Civil engineer and volunteer blood transport driver. Passionate about zero-delay blood supply for maternity units.',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
  }
];

export const INITIAL_BLOOD_REQUESTS = [
  {
    id: 'REQ-1042',
    patientName: 'Aarav Patel (Age 8)',
    hospitalName: 'Tata Memorial Hospital',
    city: 'Mumbai',
    bloodGroup: 'O-',
    unitsNeeded: 3,
    urgency: 'CRITICAL',
    timeRemaining: '2 Hours',
    condition: 'Acute Leukemia & Chemotherapy Support',
    contactPerson: 'Suresh Patel (Father)',
    contactPhone: '+91 98200 11223',
    datePosted: 'Today, 22:30 IST',
    status: 'Open'
  },
  {
    id: 'REQ-1039',
    patientName: 'Sunita Deshmukh (Age 42)',
    hospitalName: 'Apollo Hospital',
    city: 'Bangalore',
    bloodGroup: 'B-',
    unitsNeeded: 2,
    urgency: 'CRITICAL',
    timeRemaining: '3 Hours',
    condition: 'Emergency Open Heart Bypass Surgery',
    contactPerson: 'Dr. M. K. Rao (ICU Lead)',
    contactPhone: '+91 98450 33445',
    datePosted: 'Today, 21:15 IST',
    status: 'Open'
  },
  {
    id: 'REQ-1035',
    patientName: 'Mohammed Zeeshan (Age 26)',
    hospitalName: 'AIIMS Trauma Center',
    city: 'Delhi NCR',
    bloodGroup: 'AB-',
    unitsNeeded: 4,
    urgency: 'URGENT',
    timeRemaining: '6 Hours',
    condition: 'Multi-Trauma Road Traffic Accident',
    contactPerson: 'Farhan Zeeshan (Brother)',
    contactPhone: '+91 98112 44556',
    datePosted: 'Today, 19:40 IST',
    status: 'Open'
  },
  {
    id: 'REQ-1028',
    patientName: 'Kavitha Ramesh (Age 31)',
    hospitalName: 'Fortis Malar Hospital',
    city: 'Chennai',
    bloodGroup: 'A-',
    unitsNeeded: 2,
    urgency: 'URGENT',
    timeRemaining: '8 Hours',
    condition: 'High-Risk Postpartum Hemorrhage',
    contactPerson: 'Ramesh Sundaram (Spouse)',
    contactPhone: '+91 98401 66778',
    datePosted: 'Today, 18:05 IST',
    status: 'Open'
  },
  {
    id: 'REQ-1021',
    patientName: 'Debashis Roy (Age 14)',
    hospitalName: 'SSKM Medical College',
    city: 'Kolkata',
    bloodGroup: 'O+',
    unitsNeeded: 2,
    urgency: 'ROUTINE',
    timeRemaining: '24 Hours',
    condition: 'Regular Thalassemia Major Transfusion',
    contactPerson: 'Swati Roy (Mother)',
    contactPhone: '+91 98305 88990',
    datePosted: 'Today, 16:20 IST',
    status: 'Open'
  }
];

export const UPCOMING_CAMPS = [
  {
    id: 'cmp-01',
    title: 'Metro Corporate Lifesaver Blood Drive',
    organizer: 'Red Cross & TCS Health Foundation',
    city: 'Mumbai',
    venue: 'Nesco IT Park, Western Express Highway, Goregaon East',
    date: 'Nov 02, 2026',
    timing: '09:00 AM - 05:00 PM',
    targetUnits: 250,
    registeredDonors: 198,
    amenities: ['Air-Conditioned Mobile Vans', 'Free Complete Hemogram', 'Certificate & Refreshments', 'Doctor on Standby'],
    contact: 'Dr. Vivek Joshi (+91 98200 44556)',
    status: 'Open for Booking',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'cmp-02',
    title: 'University Youth Blood & Platelet Marathon',
    organizer: 'National Service Scheme (NSS) & Manipal Hospitals',
    city: 'Bangalore',
    venue: 'Bangalore University Central Auditorium, Jnanabharathi',
    date: 'Nov 05, 2026',
    timing: '10:00 AM - 06:00 PM',
    targetUnits: 300,
    registeredDonors: 242,
    amenities: ['Platelet Apheresis Station', 'Live Hemoglobin Screening', 'Digital Lifesaver Badge', 'Protein Meal Boxes'],
    contact: 'Prof. Sandhya Rani (+91 94480 77889)',
    status: 'Open for Booking',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'cmp-03',
    title: 'Civic Community Voluntary Donation Drive',
    organizer: 'Rotary Club of Delhi South & AIIMS Blood Bank',
    city: 'Delhi NCR',
    venue: 'India Habitat Centre, Lodhi Road, New Delhi',
    date: 'Nov 08, 2026',
    timing: '08:30 AM - 04:30 PM',
    targetUnits: 200,
    registeredDonors: 165,
    amenities: ['Free Blood Group Testing', 'Emergency Donor Card Issued', 'Hydration & Juice Bar', 'Doctors Consultation'],
    contact: 'Manish Bakshi (+91 98110 99887)',
    status: 'Open for Booking',
    image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'cmp-04',
    title: 'Coastal Lifeline Sunday Blood Camp',
    organizer: 'Lions Club International & Madras Medical College',
    city: 'Chennai',
    venue: 'Besant Nagar Community Center, 4th Main Road',
    date: 'Nov 12, 2026',
    timing: '09:00 AM - 03:00 PM',
    targetUnits: 150,
    registeredDonors: 118,
    amenities: ['Pediatric Thalassemia Support Camp', 'Nutritionist Advice', 'Sterile Single-Use Kits', 'Official Memento'],
    contact: 'K. Balaji (+91 98402 11223)',
    status: 'Open for Booking',
    image: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?auto=format&fit=crop&w=1200&q=80'
  }
];

export const DONATION_LIFELINE_ROADMAP = [
  {
    stepNumber: '01',
    phase: 'STEP 01 – HEALTH CHECK',
    title: 'Before You Donate',
    description: 'Before donating blood, trained medical staff check your health, weight, blood pressure and hemoglobin to make sure you are fit to donate.',
    takeaway: 'Your safety comes first.',
    iconName: 'health-check',
    additionalInfoTitle: 'Standard Pre-Donation Checks (NBTC India Guidelines)',
    milestones: [
      'A brief health history and consent screening is reviewed with trained blood centre staff.',
      'Hemoglobin is checked via a finger-prick test to confirm a safe level (at least 12.5 g/dL).',
      'Weight, blood pressure, pulse, and temperature are verified within safe clinical limits (minimum 45 kg for 350 mL or 55 kg for 450 mL collection).',
      'Only donors who are medically fit on the day of donation proceed to collection.'
    ]
  },
  {
    stepNumber: '02',
    phase: 'STEP 02 – BLOOD COLLECTION',
    title: 'Your Donation Begins',
    description: 'Once you are eligible, trained medical staff safely collect your blood using sterile, single-use equipment.',
    takeaway: 'Your donation is collected safely.',
    iconName: 'blood-collection',
    additionalInfoTitle: 'Safe Collection Practices at Licensed Blood Centres',
    milestones: [
      'The arm is cleaned with sterile antiseptic before collection begins.',
      'A brand-new, sealed, single-use sterile needle and blood bag is used for every donor and safely discarded afterwards.',
      'Medical staff monitor your comfort during collection and advise resting briefly with hydration afterwards.'
    ]
  },
  {
    stepNumber: '03',
    phase: 'STEP 03 – BLOOD TESTING & SEPARATION',
    title: 'Preparing Blood to Help Others',
    description: 'Donated blood undergoes necessary safety testing and is separated into components such as red blood cells, platelets and plasma.',
    takeaway: 'One donation can help different patients.',
    iconName: 'testing-separation',
    additionalInfoTitle: 'Mandatory Screening & Component Separation (NBTC Standards)',
    milestones: [
      'Every donated unit is typed for ABO and Rh blood groups.',
      'Mandatory screening checks for five infections under Indian regulations: HIV (1 & 2), Hepatitis B (HBsAg), Hepatitis C (HCV), Syphilis, and Malaria.',
      'Licensed blood centres separate whole blood into Red Blood Cells, Platelets, and Plasma so patients receive the specific component prescribed for their condition.'
    ]
  },
  {
    stepNumber: '04',
    phase: 'STEP 04 – SAFE STORAGE & TRANSPORTATION',
    title: 'Keeping Blood Safe',
    description: 'Blood components are stored under appropriate temperature conditions and transported safely to hospitals when required.',
    takeaway: 'Keeping blood safe until it is needed.',
    iconName: 'storage-transport',
    additionalInfoTitle: 'Controlled Cold-Chain Conditions',
    milestones: [
      'Red Blood Cells are stored in monitored refrigerators at +2°C to +6°C.',
      'Platelets are maintained at +20°C to +24°C with continuous gentle agitation.',
      'Fresh Frozen Plasma is kept frozen (typically -25°C or colder in licensed blood banks) and units move in insulated containers when requested by hospitals.'
    ]
  },
  {
    stepNumber: '05',
    phase: 'STEP 05 – BLOOD TRANSFUSION',
    title: 'Delivering Hope to Patients',
    description: 'After necessary compatibility checks and medical verification, the appropriate blood component is given to the patient by healthcare professionals.',
    takeaway: 'Your donation reaches someone who needs it.',
    iconName: 'transfusion',
    additionalInfoTitle: 'Hospital Compatibility & Transfusion Care',
    milestones: [
      'Hospital blood bank teams perform pre-transfusion compatibility testing (cross-matching) against the patient’s blood sample.',
      'Doctors and nurses double-check unit identification and compatibility records at the bedside.',
      'Healthcare professionals monitor the patient closely throughout the transfusion.'
    ]
  }
];

export const FAQ_ITEMS = [
  {
    category: 'Eligibility & Requirements',
    question: 'Who is eligible to donate blood on RED MISSION?',
    answer: 'Any healthy individual aged between 18 and 65 years with a minimum body weight of 50 kg and a hemoglobin level of at least 12.5 g/dL can donate. You must be free from active infections, fever, and major systemic illnesses at the time of donation.'
  },
  {
    category: 'Eligibility & Requirements',
    question: 'How often can I donate blood or platelets?',
    answer: 'For Whole Blood, male donors can donate once every 90 days (3 months) and female donors once every 120 days (4 months). For Single Donor Platelets (SDP Apheresis), because red blood cells are returned to your body, you can safely donate every 14 days up to 24 times in a year.'
  },
  {
    category: 'Health & Safety',
    question: 'Is it completely safe to donate blood? Can I contract an infection?',
    answer: 'Yes, blood donation is 100% safe. Every needle, tubing kit, and collection bag is strictly single-use, sterile, and discarded immediately in medical bio-waste after collection. It is impossible to contract HIV, Hepatitis, or any other blood-borne virus by donating blood.'
  },
  {
    category: 'Health & Safety',
    question: 'How long does the donation process take, and will it weaken me?',
    answer: 'The actual blood collection takes only 8 to 10 minutes! The complete process—including screening, vitals, hemoglobin check, donation, and light refreshments—takes approximately 30 minutes. Your body replenishes the 450ml fluid volume within 24 hours. You can resume regular work right after.'
  },
  {
    category: 'Preparation & Guidelines',
    question: 'What precautions should I take before and after donating blood?',
    answer: 'Have a light meal or breakfast within 2 to 3 hours before donating. Drink plenty of water (500ml) beforehand. Avoid alcohol for at least 24 hours prior. After donation, rest for 15 minutes, enjoy the provided fruit juice and snacks, avoid strenuous heavy lifting for 6 hours, and stay well-hydrated.'
  },
  {
    category: 'Blood Types & Compatibility',
    question: 'Why are O-negative and AB-positive blood groups unique?',
    answer: 'O-negative is the Universal Red Cell Donor: O- blood lacks A, B, and Rh antigens, meaning it can be transfused to any patient in life-threatening trauma emergencies when there is no time to test blood types. Conversely, AB-positive is the Universal Recipient and Universal Plasma Donor, as their plasma contains no anti-A or anti-B antibodies.'
  },
  {
    category: 'Donation Proof & Verification',
    question: 'How does RED MISSION verify donation proof and issue certificates?',
    answer: 'After donating at any hospital, blood bank, or RED MISSION camp, donors upload a photo of their donation slip/certificate along with the date and center. Our admin team cross-verifies the submission with the blood bank registry and issues an authentic digital certificate with a QR verification code.'
  },
  {
    category: 'Emergency Requests',
    question: 'How quickly can I find a donor in an emergency?',
    answer: 'Our platform matches emergency blood requests with nearby registered donors using geo-radius algorithms within seconds. Nearby compatible donors receive instant SMS, WhatsApp, and push alerts. Our average emergency response time is under 15 minutes in metropolitan zones.'
  },
  {
    category: 'AI & Blood Drop',
    question: 'What is Blood Drop and how does the voice assistant work?',
    answer: 'Blood Drop is RED MISSION\'s voice-first AI healthcare assistant. You can speak to it directly using voice commands like "Find O- donors near Lilavati Hospital" or "Is it safe to donate if I took paracetamol today?" to receive instant voice-synthesized clinical guidance and automated request dispatch.'
  },
  {
    category: 'Donation Proof & Verification',
    question: 'Can I donate if I have hypertension, diabetes, or mild allergies?',
    answer: 'Donors with well-controlled high blood pressure or diabetes on oral medications (without insulin) are eligible to donate if their vitals are normal on the donation day. Mild seasonal allergies without fever are acceptable; however, you must be off antibiotics for at least 48 hours.'
  }
];

export const INITIAL_VERIFIED_SUBMISSIONS = [
  {
    id: 'SUB-7701',
    donorName: 'Vikramaditya Sengupta',
    bloodGroup: 'O+',
    centerName: 'Rotary Blood Bank, Delhi',
    donationDate: '2026-10-24',
    unitsDonated: 1,
    proofUrl: 'donation_slip_7701.pdf',
    certificateId: 'CERT-DEL-9482',
    status: 'Verified',
    verifiedDate: '2026-10-25',
    verifiedBy: 'Dr. S. K. Gupta (Chief Medical Officer)'
  },
  {
    id: 'SUB-7688',
    donorName: 'Meera Krishnan',
    bloodGroup: 'A-',
    centerName: 'Apollo Hospitals Blood Bank, Chennai',
    donationDate: '2026-10-22',
    unitsDonated: 1,
    proofUrl: 'apollo_cert_688.jpg',
    certificateId: 'CERT-CHN-3190',
    status: 'Verified',
    verifiedDate: '2026-10-23',
    verifiedBy: 'Dr. Lakshmi Raman'
  },
  {
    id: 'SUB-7640',
    donorName: 'Tanvi Agarwal',
    bloodGroup: 'B+',
    centerName: 'Kokilaben Dhirubhai Ambani Hospital, Mumbai',
    donationDate: '2026-10-18',
    unitsDonated: 1,
    proofUrl: 'kda_slip_7640.png',
    certificateId: 'CERT-MUM-8821',
    status: 'Verified',
    verifiedDate: '2026-10-19',
    verifiedBy: 'Dr. Vivek Joshi'
  }
];

export const VOICE_PROMPTS = [
  'Find O-negative donors nearby in Mumbai',
  'What are the eligibility criteria for blood donation?',
  'Submit emergency blood request for B+ blood',
  'Where is the nearest blood donation camp this weekend?',
  'How often can I donate single donor platelets (SDP)?'
];
