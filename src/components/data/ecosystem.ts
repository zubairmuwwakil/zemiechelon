export interface ProjectItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  badge?: string;
  badgeColor?: "emerald" | "sky" | "orange" | "purple" | "indigo" | "amber";
  stack: string[];
  features?: string[];
  githubUrl?: string;
  liveUrl?: string;
  appStoreUrl?: string;
  metrics?: { label: string; value: string }[];
}

export interface SectorData {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  tagline: string;
  description: string;
  themeColor: string;
  bgBadgeClass: string;
  coordinates: { x: number; y: number; z: number };
  cameraTarget: {
    position: { x: number; y: number; z: number };
    lookAt: { x: number; y: number; z: number };
  };
  projects: ProjectItem[];
}

export const SECTORS: SectorData[] = [
  {
    id: "fintech",
    name: "Capital & Financial OS",
    shortName: "Fintech",
    icon: "Coins",
    tagline: "The Inunity Financial Continuum",
    description:
      "Four independent software products engineered with zero bank-login scraping. Standalone by design, compound in unity.",
    themeColor: "#0284c7",
    bgBadgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    coordinates: { x: -7, y: 0, z: -4 },
    cameraTarget: {
      position: { x: -7, y: 6, z: 3 },
      lookAt: { x: -7, y: 0, z: -4 },
    },
    projects: [
      {
        id: "inunity",
        name: "Inunity (inunity.ca)",
        tagline: "Personal Finance Command Hub",
        description:
          "Personal finance command center featuring Zero-Bank-Login Apple Pay Capture via iOS Wallet Automations, multi-currency ledger (CAD/USD/JMD), 12-month bill forecasting with cash cushion warnings, and 24 statutory tax/benefit compliance engines (FBAR, T1135, RDSP, FHSA).",
        category: "Command Hub",
        badge: "PRODUCTION",
        badgeColor: "emerald",
        stack: ["Next.js 16", "TypeScript", "Prisma", "Neon", "Vercel"],
        features: [
          "Instant Apple Pay Shortcut transaction capture",
          "Bank of Canada Valet live FX synchronisation",
          "12-month forward bill forecast with emergency runway alerts",
          "Cross-border tax compliance engines for US/Canada assets",
        ],
        liveUrl: "https://inunity.ca",
        githubUrl: "https://github.com/zubairmuwwakil/MoneyTalks",
      },
      {
        id: "pickme",
        name: "PickMe — Canadian Card Copilot",
        tagline: "Point-of-Sale Card Recommender",
        description:
          "100% offline native iOS copilot that tells multi-card holders exactly which credit card in their wallet to swipe right now. Evaluates earn multipliers, point valuations, monthly category caps, foreign exchange fees, and network acceptance gates (e.g. Costco = Mastercard).",
        category: "Native iOS",
        badge: "IOS 18 NATIVE",
        badgeColor: "sky",
        stack: ["Swift 6", "SwiftUI", "SwiftData", "MapKit", "Apple Maps"],
        features: [
          "Pure deterministic calculation engine running 100% on-device",
          "Annual fee ROI & keep/cancel optimization audits",
          "Instant merchant category geofencing & wallet card rules",
        ],
        githubUrl: "https://github.com/zubairmuwwakil/PickMe",
      },
      {
        id: "marketlens",
        name: "MarketLens",
        tagline: "High-Resilience Market Data Pipeline",
        description:
          "Enterprise market data pipeline with idempotent ingestion runs, row-level quarantine for malformed upstream payloads, daily OHLCV closing candles, RSI/EMA/MACD technical indicators, NYSE market calendar, and Bring-Your-Own-Key (BYOK) per-request routing.",
        category: "Backend Engine",
        badge: "ENTERPRISE API",
        badgeColor: "emerald",
        stack: ["Java 21", "Spring Boot 4", "PostgreSQL 16", "Flyway", "Alpha Vantage"],
        features: [
          "Zero-dependency Demo Profile (-Pdemo) with mock feeds",
          "Bucket4j token-bucket rate limiting & Prometheus metrics",
          "Idempotent data sync runs with row-level quarantine buffers",
        ],
        githubUrl: "https://github.com/zubairmuwwakil/marketdata",
      },
      {
        id: "looply",
        name: "Looply (Return SaaS)",
        tagline: "Autonomous Receipt & Return Intelligence",
        description:
          "Autonomous email-derived commerce intelligence. Direct inbox ingestion for purchase proofs, itemized receipts, return window countdowns, trial/subscription renewal detection, and package tracking carrier sync.",
        category: "SaaS Platform",
        badge: "INBOX SAAS",
        badgeColor: "orange",
        stack: ["Next.js 15", "Prisma", "Stripe", "Gmail API", "IMAP"],
        features: [
          "Automated receipt parsing and return deadline countdowns",
          "Trial expiration alert daemon before automatic renewals trigger",
          "Stripe billing with automated customer digest workers",
        ],
        githubUrl: "https://github.com/zubairmuwwakil/return-saas",
      },
    ],
  },
  {
    id: "intelligence",
    name: "AI & Autonomous Systems",
    shortName: "AI Systems",
    icon: "Cpu",
    tagline: "Intelligent Execution & Developer Infrastructure",
    description:
      "Developer tools, algorithmic rating engines, and autonomous multi-agent execution frameworks.",
    themeColor: "#7c3aed",
    bgBadgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    coordinates: { x: 7, y: 0, z: -4 },
    cameraTarget: {
      position: { x: 7, y: 6, z: 3 },
      lookAt: { x: 7, y: 0, z: -4 },
    },
    projects: [
      {
        id: "agent-orchestrator",
        name: "Agent Orchestrator",
        tagline: "Multi-Agent Autonomous Runtime",
        description:
          "Multi-agent runtime for autonomous coding workflows, hierarchical task delegation, deterministic state machine checkpoints, and distributed tool execution across sandboxed environments.",
        category: "AI Runtime",
        badge: "AUTONOMOUS",
        badgeColor: "purple",
        stack: ["TypeScript", "Node.js", "LLM APIs", "JSON-RPC"],
        githubUrl: "https://github.com/zubairmuwwakil/agent-orchestrator",
      },
      {
        id: "mindmap",
        name: "Mindmap",
        tagline: "Visual System Graph & Knowledge Architecture",
        description:
          "Visual graph architecture and interactive concept node mapping for software system design, architectural modeling, and interactive knowledge representations.",
        category: "Developer Tool",
        badge: "INTERACTIVE",
        badgeColor: "sky",
        stack: ["React", "TypeScript", "Canvas/SVG", "Graph Algorithms"],
        githubUrl: "https://github.com/zubairmuwwakil/mindmap",
      },
      {
        id: "glicko2-ts",
        name: "Glicko2-TS",
        tagline: "Competitive Rating Algorithm Engine",
        description:
          "Pure TypeScript mathematical implementation of the Glicko-2 rating system with rating deviation (RD) decay, volatility tracking, and match outcome recalculations.",
        category: "Algorithms",
        badge: "NPM PACKAGE",
        badgeColor: "emerald",
        stack: ["TypeScript", "Vitest", "Pure Math"],
        githubUrl: "https://github.com/zubairmuwwakil/glicko2-ts",
      },
      {
        id: "command-quest",
        name: "Command Quest",
        tagline: "Gamified CLI & Shell Mastery Platform",
        description:
          "Gamified interactive CLI terminal environment and shell learning platform for mastering POSIX tools, pipes, shell scripting, and developer workflows through bite-sized missions.",
        category: "Interactive Learning",
        badge: "GAMIFIED",
        badgeColor: "amber",
        stack: ["TypeScript", "xterm.js", "WebAssembly", "Node.js"],
        githubUrl: "https://github.com/zubairmuwwakil/command-quest",
      },
    ],
  },
  {
    id: "sports",
    name: "Sports Platforms & Operations",
    shortName: "PickleOps",
    icon: "Trophy",
    tagline: "Competitive Court & Tournament Management",
    description:
      "Shipped mobile apps and operational platforms for competitive round-robins, court session scheduling, dynamic ratings, and club check-ins.",
    themeColor: "#16a34a",
    bgBadgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    coordinates: { x: -6, y: 0, z: 5 },
    cameraTarget: {
      position: { x: -6, y: 6, z: 12 },
      lookAt: { x: -6, y: 0, z: 5 },
    },
    projects: [
      {
        id: "pickleops",
        name: "The Pickleball Social & PickleOps",
        tagline: "Tournament & Club Operations Engine",
        description:
          "Full-stack tournament management, dynamic Glicko-2 / DUPR rating sync, round-robin court rotation scheduling, member check-ins, and live bracket displays for active athletic clubs and competitive leagues.",
        category: "Mobile & Web App",
        badge: "SHIPPED TO APP STORE",
        badgeColor: "emerald",
        stack: ["Swift / SwiftUI", "Next.js", "PostgreSQL", "Tailwind CSS"],
        features: [
          "Automated round-robin rotation scheduler with court balancing",
          "Dynamic Glicko-2 skill rating recalculation per match",
          "Digital check-in kiosk and instant player match cards",
        ],
        githubUrl: "https://github.com/zubairmuwwakil/pickleops",
      },
    ],
  },
  {
    id: "principles",
    name: "Engineering Tenets",
    shortName: "Principles",
    icon: "ShieldCheck",
    tagline: "Deterministic Systems & Ambient Capital",
    description:
      "Core architectural principles governing all software engineered under the Zemi Echelon umbrella.",
    themeColor: "#d97706",
    bgBadgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    coordinates: { x: 6, y: 0, z: 5 },
    cameraTarget: {
      position: { x: 6, y: 6, z: 12 },
      lookAt: { x: 6, y: 0, z: 5 },
    },
    projects: [
      {
        id: "tenet-deterministic",
        name: "100% Deterministic & Zero Credential Scraping",
        tagline: "User Sovereignty & Rock-solid Automation",
        description:
          "We never ask users for raw bank login credentials or run fragile browser scrapers. We rely on user-owned Apple Pay automations, official APIs, and deterministic local calculation engines that cannot be broken by third-party UI updates.",
        category: "Philosophy",
        badge: "CORE TENET",
        badgeColor: "indigo",
        stack: ["Privacy First", "Local Computation", "Zero Scraping"],
      },
      {
        id: "tenet-resilience",
        name: "Fault Tolerance & Idempotent Ingestion",
        tagline: "Production Reliability Under High Concurrency",
        description:
          "Data pipelines are built with strict idempotence, row-level quarantine buffers for malformed upstream payloads, and dead-letter queues to guarantee uninterrupted operation.",
        category: "Philosophy",
        badge: "RELIABILITY",
        badgeColor: "emerald",
        stack: ["Java 21", "Spring Boot", "Idempotence", "Prometheus"],
      },
      {
        id: "tenet-ambient",
        name: "Ambient Intelligence & Self-Sufficiency",
        tagline: "Software That Works Passively For You",
        description:
          "Every product is designed to compound value silently in the background: tracking expiration windows, optimizing purchase card ROI at point-of-sale, and updating portfolios with zero manual bookkeeping burden.",
        category: "Philosophy",
        badge: "SYSTEMS",
        badgeColor: "amber",
        stack: ["Autonomous Workflows", "Background Workers", "Proactive Alerts"],
      },
    ],
  },
  {
    id: "founder",
    name: "Founder Nexus",
    shortName: "Founder",
    icon: "User",
    tagline: "Zubair Muwwakil — Principal Architect",
    description:
      "Full-stack and systems software engineer building high-concurrency Java/Spring Boot pipelines, Next.js web applications, native Swift iOS systems, and autonomous agent infrastructure.",
    themeColor: "#2563eb",
    bgBadgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    coordinates: { x: 0, y: 0, z: 0 },
    cameraTarget: {
      position: { x: 0, y: 5.5, z: 6.5 },
      lookAt: { x: 0, y: 0.5, z: 0 },
    },
    projects: [
      {
        id: "zubair",
        name: "Zubair Muwwakil",
        tagline: "Founder, Zemi Echelon",
        description:
          "Full-stack / systems software engineer building high-concurrency Java/Spring Boot pipelines, Next.js web applications, native Swift iOS systems, and autonomous agent infrastructure. Creator of the Inunity financial continuum and founder of Zemi Echelon.",
        category: "Principal Architect",
        badge: "FOUNDER",
        badgeColor: "indigo",
        stack: ["Java 21", "TypeScript", "Swift 6", "PostgreSQL", "Next.js", "Python"],
        liveUrl: "https://zubairmuwwakil.com",
        githubUrl: "https://github.com/zubairmuwwakil",
      },
    ],
  },
];

export const FOUNDER_INFO = {
  name: "Zubair Muwwakil",
  role: "Founder & Principal Architect",
  company: "Zemi Echelon Holdings & Systems",
  location: "Brooklyn, NY / Toronto, ON",
  bio: "Full-stack & systems software engineer building high-concurrency Java/Spring Boot pipelines, Next.js web applications, native Swift iOS systems, and autonomous agent infrastructure. Creator of the Inunity financial continuum.",
  skills: [
    "Java 21 / Spring Boot",
    "TypeScript & Next.js",
    "Swift 6 & SwiftUI",
    "PostgreSQL & Prisma",
    "Autonomous Agent Systems",
    "Financial Engineering",
  ],
  links: {
    portfolio: "https://zubairmuwwakil.com",
    github: "https://github.com/zubairmuwwakil",
    linkedin: "https://www.linkedin.com/in/zubairmuwwakil/",
    email: "zmuwwakil1@gmail.com",
  },
};
