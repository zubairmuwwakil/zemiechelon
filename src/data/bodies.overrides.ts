import type { ArmId, Satellite } from "@/lib/atlas/types";

export interface BodyOverride {
  arm: ArmId;
  label?: string;
  kind?: "dwarfPlanet" | "moon";
  blurb?: string;
  stack?: string[];
  live?: string;
  appStore?: string;
  satellites?: Satellite[];
  consoleId?: string;
  /** Caption for the timeline transport, when this repository names a moment. */
  milestone?: string;
}

export const OVERRIDES: Record<string, BodyOverride> = {
  // --- Products (11: 9 labelled, 2 anonymous) ---
  MoneyTalks: {
    arm: "products",
    label: "Inunity",
    kind: "moon",
    consoleId: "inunity",
    milestone: "Inunity goes live",
    blurb:
      "Personal finance command centre. Zero-bank-login Apple Pay capture, multi-currency ledger, 12-month bill forecasting, 24 statutory compliance engines.",
    stack: ["Next.js 16", "TypeScript", "Prisma", "Neon"],
    live: "https://inunity.ca",
    satellites: [
      { id: "wallet", label: "Apple Pay capture", blurb: "iOS Wallet Automations post transactions with no bank login." },
      { id: "ledger", label: "Multi-currency ledger", blurb: "CAD/USD/JMD with Bank of Canada Valet FX sync." },
      { id: "forecast", label: "Bill forecasting", blurb: "12 months forward with cash-cushion warnings." },
      { id: "compliance", label: "Compliance engines", blurb: "FBAR, T1135, RDSP, FHSA and 20 more." },
    ],
  },
  PickMe: {
    arm: "products",
    label: "PickMe",
    kind: "moon",
    consoleId: "pickme",
    milestone: "PickMe joins the console",
    blurb: "Offline iOS copilot that names the right card at checkout. Deterministic engine, entirely on-device.",
    stack: ["Swift 6", "SwiftUI", "SwiftData"],
    satellites: [
      { id: "engine", label: "Recommendation Engine", blurb: "Pure deterministic calculation engine running 100% on-device." },
      { id: "audit", label: "ROI & Fee Audits", blurb: "Annual fee ROI & keep/cancel optimization audits." },
      { id: "geofence", label: "Merchant Rules", blurb: "Instant merchant category geofencing & wallet card rules." },
    ],
  },
  marketdata: {
    arm: "products",
    label: "MarketLens",
    kind: "moon",
    milestone: "MarketLens reaches production",
    blurb:
      "Enterprise market data pipeline with idempotent ingestion runs, row-level quarantine for malformed upstream payloads, daily OHLCV closing candles, and BYOK routing.",
    stack: ["Java 21", "Spring Boot", "PostgreSQL", "Flyway"],
    satellites: [
      { id: "ingestion", label: "Idempotent Ingestion", blurb: "Idempotent data sync runs with row-level quarantine buffers." },
      { id: "ratelimit", label: "Rate Limiting", blurb: "Bucket4j token-bucket rate limiting & Prometheus metrics." },
      { id: "demo", label: "Demo Feed", blurb: "Zero-dependency Demo Profile with mock feeds." },
    ],
  },
  pickleops: {
    arm: "products",
    label: "PickleOps",
    kind: "moon",
    milestone: "PickleOps ships to the App Store",
    blurb:
      "Full-stack tournament management, dynamic Glicko-2 / DUPR rating sync, round-robin court rotation scheduling, member check-ins, and live bracket displays.",
    stack: ["Swift", "SwiftUI", "Next.js", "PostgreSQL", "Tailwind CSS"],
    satellites: [
      { id: "scheduler", label: "Rotation Scheduler", blurb: "Automated round-robin rotation scheduler with court balancing." },
      { id: "ratings", label: "Glicko-2 Recalculation", blurb: "Dynamic Glicko-2 skill rating recalculation per match." },
      { id: "kiosk", label: "Check-in Kiosk", blurb: "Digital check-in kiosk and instant player match cards." },
    ],
  },
  "return-saas": {
    arm: "products",
    label: "Looply",
    kind: "dwarfPlanet",
    blurb:
      "Autonomous email-derived commerce intelligence. Direct inbox ingestion for purchase proofs, itemized receipts, return window countdowns, and trial renewal alerts.",
    stack: ["Next.js", "TypeScript", "Prisma", "PostgreSQL", "Gmail API"],
  },
  BloombergProject: {
    arm: "products",
    label: "Bloomberg Project",
    kind: "dwarfPlanet",
  },
  Pickleball_League_Score_Tracker: {
    arm: "products",
    label: "Pickleball League Score Tracker",
    kind: "dwarfPlanet",
  },
  "pickleball-league-template": {
    arm: "products",
    label: "Pickleball League Template",
    kind: "dwarfPlanet",
  },
  pb_score_keeper: {
    arm: "products",
    label: "Pickleball Score Keeper",
    kind: "dwarfPlanet",
  },
  "market-data-pipeline": {
    arm: "products",
    label: "Private repository",
  },
  "pickleball-session-manager": {
    arm: "products",
    label: "Private repository",
  },

  // --- Labs (7: 6 labelled, 1 anonymous) ---
  "agent-orchestrator": {
    arm: "labs",
    label: "Agent Orchestrator",
    kind: "moon",
    blurb:
      "Multi-agent runtime for autonomous coding workflows, hierarchical task delegation, deterministic state machine checkpoints, and distributed tool execution.",
    stack: ["TypeScript", "Node.js", "LLM APIs", "JSON-RPC"],
  },
  openclaw: {
    arm: "labs",
    label: "OpenClaw",
    kind: "dwarfPlanet",
  },
  mindmap: {
    arm: "labs",
    label: "MindSky",
    kind: "dwarfPlanet",
    blurb:
      "Visual graph architecture and interactive concept node mapping for software system design, architectural modeling, and interactive knowledge representations.",
    stack: ["React", "TypeScript", "Canvas/SVG"],
  },
  "command-quest": {
    arm: "labs",
    label: "CommandQuest",
    kind: "dwarfPlanet",
    stack: ["Java"],
  },
  clawdbot: {
    arm: "labs",
    label: "Clawdbot",
    kind: "dwarfPlanet",
  },
  "tb-webapps": {
    arm: "labs",
    label: "TB WebApps",
    kind: "dwarfPlanet",
  },
  AiMiniProj: {
    arm: "labs",
    label: "Private repository",
  },

  // --- Self (6: 6 labelled, 0 anonymous) ---
  zemiechelon: {
    arm: "self",
    label: "Zemí Echelon",
    kind: "dwarfPlanet",
  },
  "Zubair-Portfolio-Website": {
    arm: "self",
    label: "Zubair Portfolio",
    kind: "dwarfPlanet",
    live: "https://zubairmuwwakil.com",
  },
  "Zubair-Portfolio": {
    arm: "self",
    label: "Zubair Portfolio (v1)",
    kind: "dwarfPlanet",
  },
  zubairmuwwakil: {
    arm: "self",
    label: "Zubair Muwwakil",
    kind: "dwarfPlanet",
  },
  zweb: {
    arm: "self",
    label: "zweb",
    kind: "dwarfPlanet",
  },
  projectswebsite: {
    arm: "self",
    label: "Projects Website",
    kind: "dwarfPlanet",
  },

  // --- Creative (2: 1 labelled, 1 anonymous) ---
  TodayILearned: {
    arm: "creative",
    label: "Today I Learned",
    kind: "dwarfPlanet",
  },
  Obsidian: {
    arm: "creative",
    label: "Private repository",
  },

  // --- Foundations (19: 17 labelled, 2 anonymous) ---
  AgeChecker: {
    arm: "foundations",
    label: "AgeChecker",
    kind: "dwarfPlanet",
  },
  "C--Practice": {
    arm: "foundations",
    label: "C# Practice",
    kind: "dwarfPlanet",
  },
  Coin_Flipper: {
    arm: "foundations",
    label: "Coin Flipper",
    kind: "dwarfPlanet",
  },
  CoinFlipWebsite: {
    arm: "foundations",
    label: "Coin Flip Website",
    kind: "dwarfPlanet",
  },
  DebuggingTests: {
    arm: "foundations",
    label: "Debugging Tests",
    kind: "dwarfPlanet",
  },
  DebugofFineLegal: {
    arm: "foundations",
    label: "Debug of Fine Legal",
    kind: "dwarfPlanet",
  },
  HTMl_CAT_WEBSITE: {
    arm: "foundations",
    label: "HTML Cat Website",
    kind: "dwarfPlanet",
  },
  HTML_Recipes: {
    arm: "foundations",
    label: "HTML Recipes",
    kind: "dwarfPlanet",
  },
  "HTML-Learning": {
    arm: "foundations",
    label: "HTML Learning",
    kind: "dwarfPlanet",
  },
  java: {
    arm: "foundations",
    label: "Java",
    kind: "dwarfPlanet",
  },
  "Java-Practice": {
    arm: "foundations",
    label: "Java Practice",
    kind: "dwarfPlanet",
  },
  JS_Cash_Register: {
    arm: "foundations",
    label: "JS Cash Register",
    kind: "dwarfPlanet",
    milestone: "The first commit",
  },
  JS_Cipher: {
    arm: "foundations",
    label: "JS Cipher",
    kind: "dwarfPlanet",
  },
  "JS_Tel-_Checker": {
    arm: "foundations",
    label: "JS Telephone Checker",
    kind: "dwarfPlanet",
  },
  Obsidi: {
    arm: "foundations",
    label: "Obsidi",
    kind: "dwarfPlanet",
  },
  Palindrome_Checker: {
    arm: "foundations",
    label: "Palindrome Checker",
    kind: "dwarfPlanet",
  },
  RightAngleTriangleSolver: {
    arm: "foundations",
    label: "Right Angle Triangle Solver",
    kind: "dwarfPlanet",
  },
  "A1.6_AI_Slop": {
    arm: "foundations",
    label: "Private repository",
  },
  "Obsidi-Academy": {
    arm: "foundations",
    label: "Private repository",
  },
};
