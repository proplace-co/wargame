/* ══════════════════════════════════════════════════════════════
   STAN — Skills, Phases, Directives, Injection Targets
   Data layer for the Stan sidebar.
   All data exported on window.* for use by proplace-chat-memo.js
   ══════════════════════════════════════════════════════════════ */

/* ── SKILL NAMES (displayed in chat as user message) ── */
window.SKILL_NAMES = {
  market: "Market sizing v\u00e9rifi\u00e9",
  competitive: "Analyse concurrentielle",
  redflag: "Red flag audit",
  techaudit: "Audit technique",
  techdd: "Questions DD technique",
  loi: "G\u00e9n\u00e9rer la LOI compl\u00e8te",
  callprep: "Call prep fondateur",
  email: "Email d\u2019approche fondateur",
  refcheck: "V\u00e9rification r\u00e9f\u00e9rences fondateur",
  custref: "Customer Reference Calls",
  lp: "Version LP board-ready",
  exec: "Executive summary 1 page",
  slides: "Slides comit\u00e9 5 pages",
  excel: "Mise \u00e0 jour mod\u00e8le financier",
  kpi: "Mise \u00e0 jour KPIs portfolio",
  fairvalue: "Calcul juste valeur",
  board: "Notes board meeting",
  "100days": "Plan 100 jours post-closing",
  "lp-update": "Update LP trimestriel",
  dir07: "Mod\u00e8le Financier Thesis-Aware",
  dir08: "Universal Sourcing Agent"
};

/* ── SKILL DESCRIPTIONS (for skills tab) ── */
window.SKILLS = {
  market: "V\u00e9rifie le market sizing h\u00f4telier B2B avec des donn\u00e9es 2024. TAM/SAM/SOM et sources r\u00e9centes.",
  competitive: "G\u00e9n\u00e8re une analyse concurrentielle compl\u00e8te : 8\u201310 concurrents, positioning, moat.",
  redflag: "R\u00e9alise un red flag audit syst\u00e9matique. Identifie les angles faibles et g\u00e9n\u00e8re un risk register.",
  techaudit: "G\u00e9n\u00e8re un audit technique : architecture, dette, scalabilit\u00e9, IP, questions DD technique.",
  techdd: "G\u00e9n\u00e8re les questions techniques \u00e0 poser au CTO lors de la DD.",
  loi: "G\u00e9n\u00e8re la LOI compl\u00e8te : EV, acquisition, earn-out, conditions suspensives.",
  callprep: "Pr\u00e9pare le brief pour le call CEO : 3 questions cl\u00e9s, 2 pi\u00e8ges, objectif.",
  email: "R\u00e9dige l\u2019email d\u2019approche CEO. Ton naturel, pas de mention acquisition.",
  refcheck: "G\u00e9n\u00e8re les 10 questions de v\u00e9rification de r\u00e9f\u00e9rences fondateur.",
  custref: "5 questions pour appeler les clients actuels \u2014 adoption, satisfaction, d\u00e9pendance.",
  lp: "G\u00e9n\u00e8re la version LP board-ready : ton formel, anglais, sans donn\u00e9es sensibles.",
  exec: "G\u00e9n\u00e8re l\u2019executive summary 1 page format comit\u00e9.",
  slides: "G\u00e9n\u00e8re les 5 slides du deal brief pour le comit\u00e9.",
  excel: "Lance la mise \u00e0 jour du mod\u00e8le financier Excel via Modal.",
  kpi: "Met \u00e0 jour le dashboard Portfolio Management avec les derniers KPIs.",
  fairvalue: "Calcule la juste valeur selon le multiple th\u00e8se.",
  board: "Structure les notes de board en d\u00e9cisions / actions / next steps.",
  "100days": "G\u00e9n\u00e8re le plan 100 jours post-closing : int\u00e9gration, gouvernance, synergies.",
  "lp-update": "G\u00e9n\u00e8re l\u2019update LP trimestriel : performance, faits saillants, outlook."
};

/* ── SKILL_PHASE — which phase each skill belongs to ── */
window.SKILL_PHASE = {
  market: 1, competitive: 1, redflag: 1,
  email: 2, callprep: 2,
  refcheck: 3,
  loi: 4, excel: 4,
  exec: 5, slides: 5, lp: 5,
  techaudit: 6, custref: 6,
  kpi: 7, fairvalue: 7, board: 7, "100days": 7, "lp-update": 7,
  dir07: 4, dir08: 7
};

/* ── SKILL_DIRECT — production version ──
   Each skill defines:
   - out: key for OUT_CONTENT (null = no persistent output)
   - f: follow-up button definitions
   - run: side effect function (task completion etc.)
   - execute: async function calling Modal endpoint (filled when API is ready)

   In Week 1, we keep hardcoded response text for testing.
   In Week 2, execute() replaces hardcoded responses with real API calls.
*/
window.SKILL_DIRECT = {
  market: {
    out: "market",
    f: [{ label: "Voir l\u2019analyse", tab: "outputs" }, { label: "Injecter dans le R\u00e9sum\u00e9 Ex\u00e9cutif", inject: "market" }],
    run: function() { window.stanCompleteTask("t4"); }
  },
  competitive: {
    out: null,
    f: [{ label: "Injecter dans la section March\u00e9", inject: "competitive" }, { label: "Lancer le red flag audit", skill: "redflag" }]
  },
  redflag: {
    out: "redflag",
    f: [{ label: "Voir l\u2019audit complet", tab: "outputs" }, { label: "Injecter dans Due Diligence", inject: "redflag" }],
    run: function() { window.stanCompleteTask("t3"); }
  },
  techaudit: {
    out: null,
    f: [{ label: "Injecter dans la section Produit", inject: "techaudit" }, { label: "G\u00e9n\u00e9rer les questions DD technique", skill: "techdd" }]
  },
  techdd: {
    out: null,
    f: [{ label: "Lancer l\u2019audit technique complet", skill: "techaudit" }, { label: "Injecter dans la section Produit", inject: "techaudit" }]
  },
  loi: {
    out: "loi",
    f: [{ label: "Voir la LOI", tab: "outputs" }, { label: "Partager avec l\u2019avocat", share: true }],
    run: function() { window.stanCompleteTask("t17"); }
  },
  callprep: {
    out: null,
    f: [{ label: "Voir Phase 2 dans le Parcours", tab: "roadmap" }, { label: "Lancer les r\u00e9f\u00e9rences fondateur", skill: "refcheck" }]
  },
  email: {
    out: "email",
    f: [{ label: "Voir l\u2019email", tab: "outputs" }, { label: "Partager par URL", share: true }],
    run: function() { window.stanCompleteTask("t6"); }
  },
  refcheck: {
    out: "refcheck",
    f: [{ label: "Voir les 10 questions", tab: "outputs" }, { label: "Injecter dans Due Diligence", inject: "refcheck" }, { label: "Pr\u00e9parer le call prep", skill: "callprep" }]
  },
  custref: {
    out: "custref",
    f: [{ label: "Voir les questions", tab: "outputs" }, { label: "Injecter dans Due Diligence", inject: "custref" }]
  },
  lp: {
    out: "lp",
    f: [{ label: "Voir le document LP", tab: "outputs" }, { label: "Partager par URL", share: true }]
  },
  exec: {
    out: "exec",
    f: [{ label: "Voir le document", tab: "outputs" }, { label: "Partager avec le comit\u00e9", share: true }],
    run: function() { window.stanCompleteTask("t22"); }
  },
  slides: {
    out: "slides",
    f: [{ label: "Voir les slides", tab: "outputs" }, { label: "Partager avec le comit\u00e9", share: true }]
  },
  excel: {
    out: "excel",
    f: [{ label: "Voir le mod\u00e8le financier", tab: "outputs" }]
  },
  kpi: {
    out: null,
    f: [{ label: "Calculer la juste valeur", skill: "fairvalue" }, { label: "G\u00e9n\u00e9rer l\u2019update LP", skill: "lp-update" }]
  },
  fairvalue: {
    out: null,
    f: [{ label: "Injecter la fair value dans Portfolio", inject: "fairvalue" }]
  },
  board: {
    out: null,
    f: [{ label: "Dicter mes notes dans le chat", tab: "chat" }]
  },
  "100days": {
    out: null,
    f: [{ label: "Injecter dans la section Portfolio", inject: "portfolio" }, { label: "Partager avec le fondateur", share: true }],
    run: function() { window.stanCompleteTask("t35"); }
  },
  "lp-update": {
    out: "lp-update",
    f: [{ label: "Voir l\u2019update", tab: "outputs" }, { label: "Partager avec les LPs", share: true }]
  },
  dir07: {
    out: null,
    f: [{ label: "Configurer et lancer", directive: "dir07" }]
  },
  dir08: {
    out: null,
    f: [{ label: "Configurer et lancer", directive: "dir08" }]
  }
};

/* ── OUT_CONTENT — populated by API responses at runtime ── */
window.OUT_CONTENT = {};

/* ── OUT_CONTEXT — contextual descriptions shown in output modal ── */
window.OUT_CONTEXT = {
  market: "G\u00e9n\u00e9r\u00e9 via Exa API sur donn\u00e9es 2024. V\u00e9rifie les chiffres du deck. Injectez pour l\u2019ajouter dans le R\u00e9sum\u00e9 Ex\u00e9cutif du m\u00e9mo.",
  redflag: "G\u00e9n\u00e9r\u00e9 par analyse du m\u00e9mo complet. Risques \u00e0 adresser avant la LOI. Injectez pour l\u2019ajouter dans la Due Diligence.",
  loi: "Document non-contraignant \u00e0 faire relire par votre avocat. Injectez pour l\u2019ajouter dans la Due Diligence.",
  email: "\u00c0 copier-coller dans votre messagerie. Ce document n\u2019est pas inject\u00e9 dans le m\u00e9mo.",
  exec: "Format comit\u00e9. Distribuez 48h avant le comit\u00e9. Injectez pour l\u2019ajouter dans le Verdict GP.",
  refcheck: "10 questions de v\u00e9rification g\u00e9n\u00e9r\u00e9es par Stan. Injectez dans la section Due Diligence ou partagez avec votre \u00e9quipe.",
  lp: "Version LP anglaise filtr\u00e9e. Document standalone \u2014 ne modifie pas le m\u00e9mo principal.",
  slides: "5 slides deal brief pour le comit\u00e9 IC.",
  excel: "Mod\u00e8le financier Excel avec IRR, MOIC, synergies.",
  custref: "5 questions pour les customer reference calls.",
  "lp-update": "Update LP trimestriel avec KPIs et outlook."
};

/* ── INJECT_TARGET — where each output goes in the memo ──
   selector: Stan ID (added by Make.com or mapped at runtime)
   fallback_anchor: comment anchor name in existing memos
   label: display name
   is_subcell: true = replace innerHTML, false = appendChild
*/
window.INJECT_TARGET = {
  market:      { selector: "sec-exec",    fallback_id: "market-summary",     fallback_anchor: null,         label: "R\u00e9sum\u00e9 Ex\u00e9cutif",              is_subcell: false },
  competitive: { selector: "sec-exec",    fallback_id: "market-summary",     fallback_anchor: null,         label: "R\u00e9sum\u00e9 Ex\u00e9cutif \u2014 Concurrents", is_subcell: false },
  redflag:     { selector: "sec-dd",      fallback_id: "due-diligence",      fallback_anchor: "DD_FEED",    label: "Due Diligence \u2014 Risk Register", is_subcell: false },
  loi:         { selector: "sec-dd",      fallback_id: "due-diligence",      fallback_anchor: "DD_FEED",    label: "Due Diligence \u2014 LOI",           is_subcell: false },
  exec:        { selector: "sec-verdict", fallback_id: "conviction",         fallback_anchor: null,         label: "Verdict GP \u2014 Exec Summary",     is_subcell: false },
  fairvalue:   { selector: "sec-pm",      fallback_id: "portfolio-management", fallback_anchor: "PM_FEED",  label: "Portfolio \u2014 Fair Value",         is_subcell: false },
  portfolio:   { selector: "sec-pm",      fallback_id: "portfolio-management", fallback_anchor: "PM_FEED",  label: "Portfolio Management",           is_subcell: false },
  techaudit:   { selector: "dd-product",  fallback_id: null,                 fallback_anchor: "DD_PRODUCT", label: "DD \u00b7 Produit",                  is_subcell: true },
  refcheck:    { selector: "dd-team",     fallback_id: null,                 fallback_anchor: "DD_TEAM",    label: "DD \u00b7 \u00c9quipe",                   is_subcell: true },
  custref:     { selector: "dd-biz",      fallback_id: null,                 fallback_anchor: "DD_BUSINESS", label: "DD \u00b7 Business",                is_subcell: true }
};

/* ── INJECT_SECTIONS — options shown in the injection chooser modal ── */
window.INJECT_SECTIONS = [
  { id: "sec-verdict", fallback: "conviction",          label: "Verdict GP",           desc: "Score, d\u00e9cision CALL/PASS, commentaire GP", icon: "\u2460" },
  { id: "sec-exec",    fallback: "market-summary",      label: "R\u00e9sum\u00e9 Ex\u00e9cutif",       desc: "Description soci\u00e9t\u00e9, chiffres cl\u00e9s, contexte march\u00e9", icon: "\u2461" },
  { id: "sec-dd",      fallback: "due-diligence",       label: "Due Diligence",        desc: "Documents re\u00e7us, risk register, analyses DD", icon: "\u2462" },
  { id: "dd-product",  fallback: null, anchor: "DD_PRODUCT",  label: "DD \u2014 Produit & Tech", desc: "Stack technique, architecture, dette", icon: "\u2462a", subcell: true },
  { id: "dd-team",     fallback: null, anchor: "DD_TEAM",     label: "DD \u2014 \u00c9quipe",         desc: "R\u00e9f\u00e9rences fondateurs, background", icon: "\u2462b", subcell: true },
  { id: "dd-market",   fallback: null, anchor: "DD_MARKET",   label: "DD \u2014 March\u00e9",         desc: "Market sizing, concurrents, position", icon: "\u2462c", subcell: true },
  { id: "dd-biz",      fallback: null, anchor: "DD_BUSINESS", label: "DD \u2014 Business & Traction", desc: "ARR, KPIs, contrats, clients", icon: "\u2462d", subcell: true },
  { id: "sec-pm",      fallback: "portfolio-management", label: "Portfolio Management", desc: "KPIs portfolio, plan 100j, fair value", icon: "\u2463" },
  { id: "new-section", fallback: null,                   label: "Nouvelle section",     desc: "Ajouter une section personnalis\u00e9e en bas du m\u00e9mo", icon: "+" }
];

/* ── STANDALONE OUTPUTS (not injectable) ── */
window.STANDALONE_OUTPUTS = ["email", "lp", "slides"];

/* ── STATUS FLOW ── */
window.STATUS_FLOW = {
  NEW: ["CALL", "CONSIDER", "MONITOR", "PASS"],
  CALL: ["CALLED", "PASS"],
  CONSIDER: ["CALLED", "MONITOR", "PASS"],
  MONITOR: ["CALLED", "PASS"],
  CALLED: ["MEETING_SCHEDULED", "NO_SHOWED"],
  MEETING_SCHEDULED: ["MEETING_DONE", "NO_SHOWED"],
  NO_SHOWED: ["MEETING_SCHEDULED", "PASS"],
  MEETING_DONE: ["TERMSHEET_SENT", "PASS"],
  TERMSHEET_SENT: ["REQUEST_APPROVAL_FROM_IC", "PASS"],
  REQUEST_APPROVAL_FROM_IC: ["IC_APPROVED"],
  IC_APPROVED: ["WON"],
  WON: ["IN_PORTFOLIO"],
  IN_PORTFOLIO: []
};

window.STATUS_STYLE = {
  NEW: "neutral", CALL: "call", CONSIDER: "consider", MONITOR: "monitor", PASS: "pass",
  CALLED: "neutral", MEETING_SCHEDULED: "neutral", NO_SHOWED: "pass", MEETING_DONE: "neutral",
  TERMSHEET_SENT: "neutral", REQUEST_APPROVAL_FROM_IC: "neutral",
  IC_APPROVED: "call", WON: "call", IN_PORTFOLIO: "call"
};

window.STATUS_LABELS = {
  NEW: "NEW", CALL: "CALL", CONSIDER: "CONSIDER", MONITOR: "MONITOR", PASS: "PASS",
  CALLED: "\ud83d\udcde Called", MEETING_SCHEDULED: "\ud83d\udcc5 Rdv planifi\u00e9",
  NO_SHOWED: "\u274c No show", MEETING_DONE: "\u2713 Rdv fait",
  TERMSHEET_SENT: "\ud83d\udccb TS envoy\u00e9", REQUEST_APPROVAL_FROM_IC: "\u23f3 IC",
  IC_APPROVED: "\u2705 IC approuv\u00e9", WON: "\ud83c\udfc6 WON", IN_PORTFOLIO: "\ud83d\udcca Portfolio"
};

/* ── PHASES_BY_STATUS — 7-phase M&A roadmap ── */
window.PHASES_BY_STATUS = {
  CALL: [
    {
      id: "analyse", name: "Analyse & Qualification", statuses: "NEW \u00b7 CALL \u00b7 CONSIDER", icon: "\ud83d\udd0d",
      tasks: [
        { id: "t1", label: "M\u00e9mo Proplace g\u00e9n\u00e9r\u00e9 par l\u2019IA", req: true, done: true, auto: true },
        { id: "t2", label: "Valider ou overrider la d\u00e9cision GP (CALL/CONSIDER/MONITOR/PASS)", req: true, done: false },
        { id: "t3", label: "V\u00e9rifier le fit th\u00e8se \u2014 angles actifs", req: true, done: false, skill: "redflag", skillName: "Red flag audit" },
        { id: "t4", label: "Market sizing v\u00e9rifi\u00e9 avec sources r\u00e9centes", req: false, done: false, skill: "market", skillName: "Market sizing" },
        { id: "t5", label: "Analyse concurrentielle initiale", req: false, done: false, skill: "competitive", skillName: "Analyse CC" }
      ]
    },
    {
      id: "approche", name: "Approche Fondateur", statuses: "CALLED \u00b7 MEETING_SCHEDULED", icon: "\u2709\ufe0f",
      tasks: [
        { id: "t6", label: "Email d\u2019approche personnalis\u00e9 envoy\u00e9", req: true, done: false, skill: "email", skillName: "Email d\u2019approche" },
        { id: "t7", label: "Profil LinkedIn + site actif v\u00e9rifi\u00e9s", req: true, done: false },
        { id: "t8", label: "Meeting 30 min planifi\u00e9", req: true, done: false },
        { id: "t9", label: "R\u00e9f\u00e9rences communes identifi\u00e9es", req: false, done: false }
      ]
    },
    {
      id: "decouverte", name: "D\u00e9couverte & Qualification", statuses: "MEETING_DONE", icon: "\ud83d\udcde",
      tasks: [
        { id: "t11", label: "Call prep r\u00e9alis\u00e9 avant le meeting", req: true, done: false, skill: "callprep", skillName: "Call prep" },
        { id: "t12", label: "Notes de call document\u00e9es dans le m\u00e9mo", req: true, done: false },
        { id: "t13", label: "ARR v\u00e9rifi\u00e9 (bank statements ou screenshots)", req: true, done: false },
        { id: "t14", label: "Red flag audit post-call", req: true, done: false, skill: "redflag", skillName: "Red flag audit" },
        { id: "t15", label: "3 calls de r\u00e9f\u00e9rence fondateur", req: false, done: false, skill: "refcheck", skillName: "R\u00e9f\u00e9rences" }
      ]
    },
    {
      id: "termsheet", name: "Term Sheet & Exclusivit\u00e9", statuses: "TERMSHEET_SENT", icon: "\ud83d\udccb", locked: true,
      tasks: [
        { id: "t17", label: "LOI g\u00e9n\u00e9r\u00e9e et relue par l\u2019avocat", req: true, done: false, skill: "loi", skillName: "Draft LOI" },
        { id: "t18", label: "Mod\u00e8le financier valid\u00e9 (IRR \u00b7 MOIC)", req: true, done: false, skill: "excel", skillName: "Mod\u00e8le Excel" },
        { id: "t19", label: "Exclusivit\u00e9 45 jours n\u00e9goci\u00e9e et sign\u00e9e", req: true, done: false },
        { id: "t20", label: "Co-investisseurs inform\u00e9s", req: false, done: false },
        { id: "t_dir07", label: "Mod\u00e8le financier M&A thesis-aware (Directive 07)", req: true, done: false, skill: "dir07", skillName: "Directive 07" }
      ]
    },
    {
      id: "ic", name: "Comit\u00e9 d\u2019Investissement", statuses: "REQUEST_APPROVAL \u2192 IC_APPROVED", icon: "\ud83c\udfdb", locked: true,
      tasks: [
        { id: "t22", label: "Board brief pr\u00e9par\u00e9 48h avant", req: true, done: false, skill: "exec", skillName: "Exec summary" },
        { id: "t23", label: "Slides comit\u00e9 5 pages", req: true, done: false, skill: "slides", skillName: "Slides IC" },
        { id: "t24", label: "Risk register pr\u00e9sent\u00e9", req: true, done: false, skill: "redflag", skillName: "Red flag audit" },
        { id: "t25", label: "D\u00e9cision IC document\u00e9e", req: true, done: false }
      ]
    },
    {
      id: "dd", name: "Due Diligence", statuses: "WON \u2192 closing", icon: "\ud83d\udd2c", locked: true,
      tasks: [
        { id: "t27", label: "DD l\u00e9gale mandat\u00e9e (avocat + timeline)", req: true, done: false },
        { id: "t28", label: "DD financi\u00e8re \u2014 validation ARR + contrats", req: true, done: false },
        { id: "t29", label: "DD technique \u2014 architecture + s\u00e9curit\u00e9", req: true, done: false, skill: "techaudit", skillName: "Audit technique" },
        { id: "t30", label: "Cap table v\u00e9rifi\u00e9e (actionnaires + BSPCE)", req: true, done: false },
        { id: "t31", label: "3 customer reference calls", req: true, done: false, skill: "custref", skillName: "Customer refs" },
        { id: "t32", label: "Rapport DD final consolid\u00e9", req: true, done: false }
      ]
    },
    {
      id: "portfolio", name: "Portfolio Management", statuses: "IN_PORTFOLIO", icon: "\ud83d\udcca", locked: true,
      tasks: [
        { id: "t35", label: "Plan 100 jours post-closing partag\u00e9", req: true, done: false, skill: "100days", skillName: "Plan 100 jours" },
        { id: "t36", label: "Setup reporting mensuel (template envoy\u00e9)", req: true, done: false, skill: "kpi", skillName: "Mise \u00e0 jour KPIs" },
        { id: "t37", label: "Premi\u00e8re board meeting J+30", req: true, done: false, skill: "board", skillName: "Notes board" },
        { id: "t38", label: "Int\u00e9gration syst\u00e8mes (Trevium \u00b7 API)", req: true, done: false },
        { id: "t39", label: "Fair value calcul\u00e9e et document\u00e9e", req: false, done: false, skill: "fairvalue", skillName: "Juste valeur" },
        { id: "t40", label: "Update LP trimestriel envoy\u00e9", req: false, done: false, skill: "lp-update", skillName: "Update LP" }
      ]
    }
  ]
};

/* ── SKILLS TAB LAYOUT — organizes skills by phase for display ── */
window.SKILLS_TAB_LAYOUT = [
  {
    phase: "\ud83d\udd0d Analyse & Qualification",
    items: [
      { type: "skill", key: "market", name: "Market sizing v\u00e9rifi\u00e9", desc: "Rapport march\u00e9 avec TAM/SAM/SOM sourc\u00e9s via Exa sur donn\u00e9es 2024." },
      { type: "skill", key: "competitive", name: "Analyse concurrentielle", desc: "Tableau de 8\u201310 concurrents r\u00e9els avec positionnement et funding." },
      { type: "skill", key: "redflag", name: "Red flag audit", desc: "Audit complet du m\u00e9mo : signaux faibles, donn\u00e9es non v\u00e9rifi\u00e9es, risques." }
    ]
  },
  {
    phase: "\u2709\ufe0f Approche Fondateur",
    items: [
      { type: "skill", key: "email", name: "Email d\u2019approche", desc: "Email court pr\u00eat \u00e0 envoyer : ton naturel, angle partenariat." },
      { type: "skill", key: "callprep", name: "Call prep fondateur", desc: "Brief de pr\u00e9paration : 3 questions cl\u00e9s, 2 pi\u00e8ges \u00e0 \u00e9viter." }
    ]
  },
  {
    phase: "\ud83d\udcde D\u00e9couverte & Qualification",
    items: [
      { type: "skill", key: "refcheck", name: "R\u00e9f\u00e9rences fondateur", desc: "10 questions pour appeler les ex-coll\u00e8gues du fondateur." }
    ]
  },
  {
    phase: "\ud83d\udccb Term Sheet & Exclusivit\u00e9",
    items: [
      { type: "skill", key: "loi", name: "Draft LOI compl\u00e8te", desc: "LOI non-contraignante r\u00e9dig\u00e9e : EV, structure, earn-out, conditions suspensives." },
      { type: "skill", key: "excel", name: "Mod\u00e8le financier Excel", desc: "Mod\u00e8le financier Excel mis \u00e0 jour via Modal : IRR, MOIC, multiples, synergies." },
      { type: "directive", key: "dir07", name: "\u26a1 Mod\u00e8le Financier Thesis-Aware (Directive 07)", desc: "P&L 5 ans \u00b7 IRR \u00b7 MOIC \u00b7 Synergies \u00b7 Cap table \u2014 g\u00e9n\u00e9r\u00e9 via Modal Python" }
    ]
  },
  {
    phase: "\ud83c\udfdb Comit\u00e9 d\u2019Investissement",
    items: [
      { type: "skill", key: "exec", name: "Executive summary 1 page", desc: "Synth\u00e8se 1 page format IC : opportunit\u00e9, th\u00e8se, m\u00e9triques cl\u00e9s, recommandation." },
      { type: "skill", key: "slides", name: "Slides comit\u00e9 5 pages", desc: "5 slides deal brief : cover, opportunit\u00e9, fit th\u00e8se, financials, recommandation." },
      { type: "skill", key: "lp", name: "Version LP board-ready", desc: "M\u00e9mo LP en anglais, donn\u00e9es sensibles filtr\u00e9es." },
      { type: "directive", key: "dir_slides_ic", name: "\u26a1 Slides IC PowerPoint (Modal)", desc: "8 slides deal brief g\u00e9n\u00e9r\u00e9es via python-pptx \u2014 design S4BT \u2014 t\u00e9l\u00e9chargeable" },
      { type: "directive", key: "dir_ic_memo", name: "\u26a1 M\u00e9mo IC Complet (10 pages)", desc: "M\u00e9mo IC board-ready 10 pages \u00b7 prompt pr\u00eat \u00e0 copier dans Claude Projects" }
    ]
  },
  {
    phase: "\ud83d\udd2c Due Diligence",
    items: [
      { type: "skill", key: "techaudit", name: "Audit technique", desc: "Rapport technique via BuiltWith + GitHub : stack, dette, repos publics." },
      { type: "skill", key: "custref", name: "Customer reference calls", desc: "5 questions pour appeler les clients actuels." },
      { type: "directive", key: "dir_tech_dd", name: "\u26a1 Audit Technique Complet (BuiltWith + GitHub)", desc: "Stack r\u00e9el \u00b7 dette technique \u00b7 10 questions DD CTO" },
      { type: "directive", key: "dir_legal_dd", name: "\u26a1 Checklist DD L\u00e9gale", desc: "IP \u00b7 contrats \u00b7 cap table \u00b7 RGPD \u00b7 litiges" },
      { type: "directive", key: "dir_founder_refs", name: "\u26a1 R\u00e9f\u00e9rences LinkedIn Fondateur (Apify)", desc: "10 contacts LinkedIn identifi\u00e9s \u00b7 questions personnalis\u00e9es par profil" }
    ]
  },
  {
    phase: "\ud83d\udcca Portfolio Management",
    items: [
      { type: "skill", key: "lp-update", name: "Update LP trimestriel", desc: "Performance trimestrielle format\u00e9e pour vos LPs." },
      { type: "skill", key: "100days", name: "Plan 100 jours post-closing", desc: "Int\u00e9gration API, gouvernance, synergies \u00e0 activer." },
      { type: "skill", key: "kpi", name: "Mise \u00e0 jour KPIs", desc: "Dashboard Portfolio mis \u00e0 jour depuis le reporting." },
      { type: "skill", key: "fairvalue", name: "Juste valeur (fair value)", desc: "EV estim\u00e9e calcul\u00e9e selon le multiple th\u00e8se." },
      { type: "skill", key: "board", name: "Notes board meeting", desc: "Structure vos notes de board en d\u00e9cisions / actions / next steps." },
      { type: "directive", key: "dir08", name: "\u26a1 Universal Sourcing Agent (Directive 08)", desc: "Agent autonome \u00b7 trouve 20 cibles similaires \u00b7 Exa + LinkedIn \u00b7 JSON structur\u00e9" },
      { type: "directive", key: "dir_lp_report", name: "\u26a1 Rapport LP Trimestriel Complet", desc: "Format S4BT \u00b7 anglais \u00b7 donn\u00e9es KPI pr\u00e9-remplies" }
    ]
  }
];

/* ══════════════════════════════════════════════════════════════
   DIRECTIVES — 12 advanced skill configurations
   Each directive = config autonome with engine, params, prompt
   ══════════════════════════════════════════════════════════════ */

window.DIRECTIVES = {

  /* ── PHASE 1 — Analyse & Qualification ── */

  dir_market_intel: {
    id: "dir_market_intel", name: "Intelligence March\u00e9 Approfondie", phase: 1,
    engine: "exa", endpoint: "/skill/market-intel",
    output_type: "inject", inject_target: "sec-exec",
    description: "TAM/SAM/SOM v\u00e9rifi\u00e9s via Exa sur sources 2024. Hypoth\u00e8ses explicit\u00e9es et challeng\u00e9es.",
    params: function(deal) {
      return { company: deal.name, sector: "hotel distribution B2B", arr: deal.arr, geography: "Europe", angle: deal.thesis_angle };
    },
    prompt_template: function(p) {
      return "Tu es un analyste M&A senior sp\u00e9cialis\u00e9 travel tech.\n\nDeal : " + p.company + " \u00b7 ARR " + p.arr + " \u00b7 Angle : " + p.angle + "\n\nMission : G\u00e9n\u00e8re une analyse de march\u00e9 structur\u00e9e pour un comit\u00e9 d\u2019investissement.\n\n1. TAM total (march\u00e9 adressable global hotel booking)\n2. SAM (march\u00e9 corporate/B2B travel, Europe)\n3. SOM r\u00e9aliste sur 5 ans\n4. Sources r\u00e9centes (2023-2024)\n5. Hypoth\u00e8ses explicit\u00e9es\n6. Risques de march\u00e9\n\nFormat : JSON structur\u00e9 avec sections tam, sam, som, growth_drivers, risks, sources.";
    }
  },

  dir_thesis_fit: {
    id: "dir_thesis_fit", name: "Thesis Fit Scorer", phase: 1,
    engine: "claude", output_type: "inject", inject_target: "sec-verdict",
    description: "Score de fit th\u00e8se calcul\u00e9 sur 12 crit\u00e8res. Identifie les angles actifs et les signaux BLOCK.",
    params: function(deal) {
      return { company: deal.name, arr: deal.arr, angle: deal.thesis_angle, score: deal.score };
    },
    prompt_template: function(p) {
      return "\u00c9value le fit th\u00e8se pour " + p.company + " (ARR " + p.arr + ", angle " + p.angle + ", score actuel " + p.score + "/100).\n\nCrit\u00e8res \u00e0 scorer sur 10 :\n1. Fit angle th\u00e8se\n2. ARR qualit\u00e9 (r\u00e9current vs ponctuel)\n3. NRR et r\u00e9tention\n4. Moat d\u00e9fendable\n5. Timing march\u00e9\n6. \u00c9quipe ex\u00e9cution\n7. Fit int\u00e9gration\n8. Concentration revenues\n9. Risque r\u00e9glementaire\n10. Potentiel synergies\n\nRetourne un JSON avec scores, commentaires, signal (CALL/CONSIDER/MONITOR/PASS), et 3 questions critiques.";
    }
  },

  /* ── PHASE 2 — Approche Fondateur ── */

  dir_outreach: {
    id: "dir_outreach", name: "Email d\u2019Approche Personnalis\u00e9", phase: 2,
    engine: "copy_claude", output_type: "standalone",
    description: "Email court, ton naturel, angle \u00e9cosyst\u00e8me. Stan analyse le profil LinkedIn du fondateur et personnalise chaque mot.",
    params: function(deal) {
      return { company: deal.name, founder: "CEO", angle: deal.thesis_angle, arr: deal.arr };
    },
    prompt_template: function(p) {
      return "R\u00e9dige un email d\u2019approche pour le CEO de " + p.company + " de la part d\u2019Alexandre Busson, Managing Partner S4BT.\n\nContexte S4BT : fonds M&A pan-europ\u00e9en qui construit un \u00e9cosyst\u00e8me d\u2019infrastructure voyage d\u2019affaires.\n\nContraintes STRICTES :\n- Jamais mentionner acquisition ou rachat\n- Ton naturel, pas corporate\n- Max 80 mots\n- Angle : \u00e9cosyst\u00e8me, compl\u00e9mentarit\u00e9, introduction\n- Objet : court, curiosit\u00e9 sans clickbait\n\nR\u00e9dige 3 variantes : directe / anecdote march\u00e9 / question ouverte.";
    }
  },

  /* ── PHASE 4 — Term Sheet & Exclusivite ── */

  dir07: {
    id: "dir07", name: "Mod\u00e8le Financier Thesis-Aware", phase: 4,
    engine: "modal", endpoint: "/skill/financial-model",
    output_type: "file", file_type: "xlsx",
    description: "Directive 07 \u2014 Mod\u00e8le financier complet Strategic Acquirer. P&L 5 ans, cash flows, retours IRR/MOIC, cap table, sensitivity matrix, synergies.",
    modal_endpoint: "https://proplace-co--financial-model-v2.modal.run/skill/financial-model",
    params: function(deal) {
      return {
        mode: "MA_STRATEGIC_ACQUIRER", company_name: deal.name,
        arr: deal.arr, arr_growth_rate: 0.38, ev: deal.ev,
        multiple_entry: 5.7, multiple_exit: 8.5,
        earnout_amount: 2400000, earnout_years: 2,
        cost_synergy_pct: 0.30, revenue_synergy_pct: 0.20,
        hold_period_years: 5, fund_thesis: deal.thesis_angle || "hotel_content_expansion",
        acquirer: deal.fund || "S4BT", currency: "EUR"
      };
    },
    prompt_template: function(p) {
      return "# Directive 07 \u2014 Mod\u00e8le Financier M&A\n\nParameters:\n" + JSON.stringify(p, null, 2) + "\n\nG\u00e9n\u00e8re un mod\u00e8le financier Excel complet avec :\n- Sheet 1 : P&L 5 ans (croissance " + Math.round(p.arr_growth_rate * 100) + "% \u2192 18%)\n- Sheet 2 : Cash flows + earnout\n- Sheet 3 : Returns (IRR, MOIC, sensitivity \u00b120%)\n- Sheet 4 : Cap table post-closing\n- Sheet 5 : Synergies (" + Math.round(p.cost_synergy_pct * 100) + "% cost + " + Math.round(p.revenue_synergy_pct * 100) + "% rev)\n\nTous les chiffres en EUR. Formules Excel r\u00e9elles.";
    }
  },

  /* ── PHASE 5 — Comite d'Investissement ── */

  dir_ic_memo: {
    id: "dir_ic_memo", name: "M\u00e9mo IC Complet", phase: 5,
    engine: "copy_claude", output_type: "standalone",
    description: "M\u00e9mo comit\u00e9 d\u2019investissement complet 8-10 pages. Stan pr\u00e9-remplit tout le contexte deal.",
    params: function(deal) {
      return { company: deal.name, arr: deal.arr, ev: deal.ev, score: deal.score, angle: deal.thesis_angle };
    },
    prompt_template: function(p) {
      return "Tu es un GP de fonds M&A. R\u00e9dige un m\u00e9mo IC complet pour " + p.company + ".\n\nDonn\u00e9es deal :\n- ARR : " + p.arr + "\n- EV : " + p.ev + "\n- Score Proplace : " + p.score + "/100\n- Angle th\u00e8se : " + p.angle + "\n\nStructure obligatoire :\n1. Executive Summary (1 page)\n2. Opportunit\u00e9 de march\u00e9\n3. Analyse comp\u00e9titive\n4. Mod\u00e8le business et traction\n5. \u00c9quipe fondateurs\n6. Th\u00e8se d\u2019investissement\n7. Valorisation et structure\n8. Risques et mitigants\n9. Plan post-closing 100 jours\n10. Annexes\n\nTon : board-ready, factuel. Chaque affirmation sourc\u00e9e.";
    }
  },

  dir_slides_ic: {
    id: "dir_slides_ic", name: "Slides IC PowerPoint", phase: 5,
    engine: "modal", endpoint: "/skill/slides-generator",
    output_type: "file", file_type: "pptx",
    description: "Directive PPTX \u2014 8 slides deal brief format comit\u00e9. G\u00e9n\u00e9r\u00e9es via python-pptx sur Modal.",
    params: function(deal) {
      return { company: deal.name, arr: deal.arr, ev: deal.ev, recommendation: "CALL", date: new Date().toLocaleDateString("fr-FR") };
    },
    prompt_template: function(p) {
      return "G\u00e9n\u00e8re les donn\u00e9es structur\u00e9es pour 8 slides IC sur " + p.company + ".\n\nSlide 1 : Cover \u00b7 " + p.company + " \u00b7 S4BT \u00b7 " + p.date + "\nSlide 2 : Opportunit\u00e9 (TAM, angle, timing)\nSlide 3 : Fit th\u00e8se\nSlide 4 : Traction (ARR " + p.arr + ", m\u00e9triques cl\u00e9s)\nSlide 5 : Structure deal (EV " + p.ev + ", earn-out)\nSlide 6 : Synergies\nSlide 7 : Risques top 3\nSlide 8 : Recommandation " + p.recommendation + " + next steps\n\nRetourne JSON avec title, subtitle, bullets[], note_speaker[] pour chaque slide.";
    }
  },

  /* ── PHASE 6 — Due Diligence ── */

  dir_tech_dd: {
    id: "dir_tech_dd", name: "Audit Technique Complet", phase: 6,
    engine: "modal", endpoint: "/skill/tech-audit",
    output_type: "inject", inject_target: "dd-product",
    description: "BuiltWith + GitHub API + Claude. Stack r\u00e9el, dette technique, questions DD CTO.",
    params: function(deal) {
      return { company_url: deal.name.toLowerCase().replace(/\s+/g, "") + ".com", company_name: deal.name, github_org: deal.name.toLowerCase().replace(/\s+/g, "") };
    },
    prompt_template: function(p) {
      return "Audit technique pour " + p.company_name + " (" + p.company_url + ").\n\nAnalyse :\n1. Stack technique (depuis BuiltWith)\n2. Repos GitHub (activit\u00e9, qualit\u00e9 code, contributeurs)\n3. Infrastructure (cloud, scaling)\n4. S\u00e9curit\u00e9 (headers, SSL, vuln\u00e9rabilit\u00e9s publiques)\n5. IP propre vs open source\n6. G\u00e9n\u00e8re 10 questions \u00e0 poser au CTO en DD\n\nRetourne JSON structur\u00e9 avec verdict (NO_ISSUE/MINOR/MAJOR/BLOCKER) pour chaque dimension.";
    }
  },

  dir_legal_dd: {
    id: "dir_legal_dd", name: "Checklist DD L\u00e9gale", phase: 6,
    engine: "copy_claude", output_type: "inject", inject_target: "sec-dd",
    description: "Checklist DD l\u00e9gale compl\u00e8te : contrats, IP, RGPD, cap table, litiges.",
    params: function(deal) {
      return { company: deal.name, country: deal.country || "NL", structure: "100% acquisition", ev: deal.ev };
    },
    prompt_template: function(p) {
      return "G\u00e9n\u00e8re une checklist DD l\u00e9gale compl\u00e8te pour l\u2019acquisition de " + p.company + " (pays : " + p.country + ", structure : " + p.structure + ", EV : " + p.ev + ").\n\nSections :\n1. Statuts et gouvernance (cap table, BSPCEs, shareholder agreements)\n2. Contrats commerciaux (clients, fournisseurs, key man)\n3. Propri\u00e9t\u00e9 intellectuelle (brevets, marques, code source)\n4. RGPD et donn\u00e9es (DPA, transferts internationaux)\n5. Litiges en cours\n6. Compliance (AML, r\u00e9glementaire secteur)\n7. Fiscalit\u00e9 (structures, optimisations, risques)\n\nPour chaque item : document \u00e0 demander + red flag si absent + criticit\u00e9 (1-3).";
    }
  },

  dir_founder_refs: {
    id: "dir_founder_refs", name: "R\u00e9f\u00e9rences Fondateur LinkedIn", phase: 6,
    engine: "apify", endpoint: "/skill/linkedin-refs",
    output_type: "inject", inject_target: "dd-team",
    description: "Apify Actor LinkedIn. Identifie les 10 premiers contacts du CEO.",
    params: function(deal) {
      return { founder_linkedin: "", company: deal.name, focus_years: 3 };
    },
    prompt_template: function(p) {
      return "G\u00e9n\u00e8re un guide de v\u00e9rification r\u00e9f\u00e9rences pour le fondateur de " + p.company + ".\n\n10 questions par profil de r\u00e9f\u00e9rence :\n\nPour ex-coll\u00e8gues : ex\u00e9cution, delivery, gestion conflits\nPour ex-investisseurs : engagement, transparence, chiffres tenus\nPour premiers clients : satisfaction, d\u00e9pendance, NPS r\u00e9el\n\nPour chaque contact identifi\u00e9, g\u00e9n\u00e8re 3 questions personnalis\u00e9es selon son r\u00f4le.";
    }
  },

  /* ── PHASE 7 — Portfolio Management ── */

  dir08: {
    id: "dir08", name: "Universal Sourcing Agent", phase: 7,
    engine: "modal", endpoint: "/skill/sourcing-agent",
    output_type: "standalone",
    description: "Directive 08 \u2014 Agent de sourcing autonome. Trouve des cibles similaires dans l\u2019\u00e9cosyst\u00e8me travel tech europ\u00e9en.",
    modal_endpoint: "https://proplace-co--sourcing-agent.modal.run/skill/sourcing",
    params: function(deal) {
      return {
        fund: deal.fund || "S4BT", thesis_angle: deal.thesis_angle,
        reference_company: deal.name, reference_arr: deal.arr,
        geography: "Europe", stage: "Series A - B",
        exclude: [deal.name], sources: ["exa_find_similar", "exa_semantic", "linkedin_search"],
        max_results: 20
      };
    },
    prompt_template: function(p) {
      return "# Directive 08 \u2014 Universal Sourcing Agent\n\nFund thesis: " + p.fund + " \u00b7 Angle: " + p.thesis_angle + "\nReference company: " + p.reference_company + " (ARR " + p.reference_arr + ")\n\nTrouve 20 entreprises similaires \u00e0 " + p.reference_company + " dans l\u2019\u00e9cosyst\u00e8me travel tech B2B europ\u00e9en.\n\nCrit\u00e8res :\n- API-first ou infrastructure play\n- ARR \u20ac1-10M\n- Europe (FR, NL, DE, UK, ES prioritaires)\n- S\u00e9rie A ou B\n- Angle : " + p.thesis_angle + "\n\nPour chaque cible :\n1. Nom + URL + pays\n2. Description en 1 ligne\n3. ARR estim\u00e9\n4. Raison du fit th\u00e8se\n5. Signal de contact recommand\u00e9\n\nRetourne JSON structur\u00e9 avec score_fit (1-10) pour chaque cible.";
    }
  },

  dir_100days: {
    id: "dir_100days", name: "Plan 100 Jours Post-Closing", phase: 7,
    engine: "copy_claude", output_type: "inject", inject_target: "sec-pm",
    description: "Plan op\u00e9rationnel 100 jours complet. Int\u00e9gration, gouvernance, synergies.",
    params: function(deal) {
      return { company: deal.name, ev: deal.ev, synergies: "30% cost + 20% rev uplift", acquirer: deal.fund || "S4BT", systems: "Trevium, HotelHub" };
    },
    prompt_template: function(p) {
      return "G\u00e9n\u00e8re un plan 100 jours post-closing pour l\u2019acquisition de " + p.company + " par " + p.acquirer + " (EV " + p.ev + ").\n\nJ+0 \u00e0 J+30 : INT\u00c9GRATION SYST\u00c8MES\n- Audit API " + p.company + " / " + p.systems + " compatibility\n- Setup reporting commun\n- Introduction \u00e9quipes\n- Identify quick wins synergies\n\nJ+30 \u00e0 J+60 : GOUVERNANCE\n- Premi\u00e8re board meeting\n- D\u00e9finir KPIs portfolio\n- Plan recrutement\n- Activation partenariats " + p.systems + "\n\nJ+60 \u00e0 J+100 : SYNERGIES\n- Activer synergies co\u00fbt (" + p.synergies + ")\n- Premier pipeline co-selling\n- Rapport LP J+90\n\nFormat : tableaux avec owner, deadline, d\u00e9pendances, RAG status.";
    }
  },

  dir_lp_report: {
    id: "dir_lp_report", name: "Rapport LP Trimestriel", phase: 7,
    engine: "copy_claude", output_type: "standalone",
    description: "Rapport LP trimestriel. Donn\u00e9es KPI pr\u00e9-remplies depuis le reporting. Anglais, sans donn\u00e9es sensibles.",
    params: function(deal) {
      return { company: deal.name, arr: deal.arr, quarter: "Q1 2026" };
    },
    prompt_template: function(p) {
      return "Write a quarterly LP update for " + p.company + " (" + p.quarter + ").\n\nKPIs : ARR " + p.arr + " | NRR 112% | Runway 18 months | Churn 0.8%\n\nSections:\n1. Executive Summary (3 sentences max)\n2. Key Milestones This Quarter\n3. KPI Dashboard\n4. Challenges & Mitigants\n5. Next Quarter Focus\n6. Outlook (Positive / Neutral / Cautious)\n\nTone: professional, factual, no hype. Audience: institutional LPs. Max 1 page.";
    }
  }
};
