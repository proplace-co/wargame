/* ══════════════════════════════════════════════════════════════
   STAN — Main sidebar IIFE
   Loads assets, builds sidebar DOM, wires all interactions.
   Replaces proplace-editor.js on memos with <meta name="stan-deal">.
   ══════════════════════════════════════════════════════════════ */
(function() {
  "use strict";

  /* ── 1. Read deal context from meta tag ── */
  var meta = document.querySelector('meta[name="stan-deal"]');
  if (!meta) return; // Not a Stan memo — do nothing

  var DEAL_CONTEXT;
  try { DEAL_CONTEXT = JSON.parse(meta.getAttribute("content")); }
  catch(e) { console.error("Stan: invalid deal meta", e); return; }

  window.DEAL_CONTEXT = DEAL_CONTEXT;
  window.STAN_LANG = DEAL_CONTEXT.lang || "fr";

  /* ── 2. State ── */
  var attached = [];
  var historyItems = [];
  var savedOutputs = [];
  var pendingOut = null;
  var expandedPhases = { 0: true };
  var DEAL_STATUS = DEAL_CONTEXT.status || "CALL";
  var nextActOpen = false;
  var guideOpen = false;
  var _firstVisit = true;
  var PHASES = [];

  var pendingInjectKey = null;
  var pendingInjectHtml = null;
  var selectedInjectTarget = null;
  var pasteDirectiveId = null;
  var pasteDirectiveName = null;

  /* ── Modal API base URL ── */
  var MODAL_BASE = "https://alexandre-79537--";

  /* ── CEO Decision constants ── */
  var STAN_PROXY_URL        = "https://alexandre-79537--stan-skills-fastapi-app.modal.run";
  var AIRTABLE_BRIDGE_URL   = "https://alexandre-79537--airtable-bridge-fastapi-app.modal.run";
  var STATUS_COLORS = {
    CALL:     { bg: "#4ac67f", text: "#fff" },
    CONSIDER: { bg: "#ca8a04", text: "#fff" },
    MONITOR:  { bg: "#2563eb", text: "#fff" },
    PASS:     { bg: "#dc2626", text: "#fff" },
  };
  var _stanPendingDecision = null;

  /* ── 3. Load assets dynamically ── */
  function loadAssets(cb) {
    var base = getBaseUrl();
    var loaded = 0;
    var total = 3;

    var hideOldEditor = document.createElement("style");
    hideOldEditor.textContent = "#plEditor{display:none!important;}";
    document.head.appendChild(hideOldEditor);

    function tick() { loaded++; if (loaded >= total && cb) cb(); }

    // CSS
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = base + "stan-styles.css";
    link.onload = tick;
    link.onerror = tick;
    document.head.appendChild(link);

    // i18n
    var s1 = document.createElement("script");
    s1.src = base + "stan-i18n.js";
    s1.onload = tick;
    s1.onerror = tick;
    document.head.appendChild(s1);

    // skills
    var s2 = document.createElement("script");
    s2.src = base + "stan-skills.js";
    s2.onload = tick;
    s2.onerror = tick;
    document.head.appendChild(s2);

    // Fonts (non-blocking)
    if (!document.querySelector('link[href*="cormorant"]')) {
      var f = document.createElement("link");
      f.rel = "stylesheet";
      f.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;700&display=swap";
      document.head.appendChild(f);
    }
  }

  function getBaseUrl() {
    var scripts = document.querySelectorAll("script[src]");
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src.indexOf("proplace-chat-memo") !== -1) {
        return scripts[i].src.replace(/proplace-chat-memo\.js.*$/, "");
      }
    }
    return "https://proplace-co.github.io/wargame/";
  }

  /* ── 4. t() wrapper — safe before i18n loads ── */
  function t(key) {
    if (window.t) return window.t(key);
    return key;
  }

  /* ── 5. Wrap body in layout ── */
  function wrapLayout() {
    document.documentElement.classList.add("stan-active");
    var body = document.body;
    var children = Array.prototype.slice.call(body.childNodes);
    var memoWrap = document.createElement("div");
    memoWrap.className = "stan-memo-col";
    memoWrap.id = "stan-memo-col";
    var memoScroll = document.createElement("div");
    memoScroll.className = "stan-memo-scroll";
    memoScroll.id = "memo-content";
    children.forEach(function(c) { memoScroll.appendChild(c); });
    memoWrap.appendChild(memoScroll);

    var layout = document.createElement("div");
    layout.className = "stan-layout";
    layout.id = "stan-layout";
    layout.appendChild(memoWrap);
    body.appendChild(layout);

    return layout;
  }

  /* ── 6. Build sidebar DOM ── */
  function buildSidebar(layout) {
    var sb = document.createElement("div");
    sb.className = "stan-sidebar closed";
    sb.id = "stan-sidebar";

    var dealName = DEAL_CONTEXT.name || "Deal";
    var fundName = DEAL_CONTEXT.fund || "S4BT";

    sb.innerHTML =
      /* Header */
      '<div class="stan-s-hd">' +
        '<div class="stan-s-hd-top">' +
          '<div>' +
            '<div class="stan-s-eye">Stan \u00b7 ' + fundName + ' \u00b7 M&A</div>' +
            '<div class="stan-s-deal">' + dealName + '</div>' +
          '</div>' +
          '<div class="stan-s-hd-right">' +
            '<span class="stan-tpil call" id="stan-curBadge">' + DEAL_STATUS + '</span>' +
            '<button id="stan-guidePillBtn" title="Guide" class="stan-guide-pill">?</button>' +
            '<button class="stan-s-close" id="stan-close-btn">\u00d7</button>' +
          '</div>' +
        '</div>' +
        '<div id="stan-status-block" style="padding:10px 12px 4px"></div>' +
      '</div>' +

      /* Next action */
      '<div class="stan-next-act" id="stan-nextAct">' +
        '<span class="stan-na-dot"></span>' +
        '<div class="stan-na-body">' +
          '<div class="stan-na-eyebrow">' + t("next_action") + '</div>' +
          '<div class="stan-na-txt" id="stan-naTxt"></div>' +
        '</div>' +
        '<span class="stan-na-chevron" id="stan-naChev">\u2193</span>' +
      '</div>' +

      /* Tabs */
      '<div class="stan-tabs">' +
        '<button class="stan-tab on" id="stan-tab-roadmap">' + t("parcours") + '</button>' +
        '<button class="stan-tab" id="stan-tab-chat">' + t("chat") + '</button>' +
        '<button class="stan-tab" id="stan-tab-skills">' + t("skills") + '</button>' +
        '<button class="stan-tab" id="stan-tab-outputs">' + t("outputs") + '<span class="stan-bdg" id="stan-outBdg">0</span></button>' +
        '<button class="stan-tab" id="stan-tab-hist">' + t("historique") + '</button>' +
      '</div>' +

      /* Pane: Roadmap */
      '<div class="stan-pane on" id="stan-pane-roadmap">' +
        '<div class="stan-rm-scroll">' +
          '<div class="stan-rm-top">' +
            '<div class="stan-rm-prog-row">' +
              '<span class="stan-rm-prog-title" id="stan-rmTitle">Phase 1/7</span>' +
              '<span class="stan-rm-prog-pct" id="stan-rmPct">0%</span>' +
            '</div>' +
            '<div class="stan-rm-prog-bar"><div class="stan-rm-prog-fill" id="stan-rmFill"></div></div>' +
            '<div class="stan-rm-sub" id="stan-rmSub"></div>' +
          '</div>' +
          '<div class="stan-rm-hint">' + t("auto_label") + '</div>' +
          '<div id="stan-timelineEl"></div>' +
        '</div>' +
      '</div>' +

      /* Pane: Chat */
      '<div class="stan-pane" id="stan-pane-chat">' +
        '<div class="stan-msgs" id="stan-msgs"></div>' +
        '<div class="stan-tw" id="stan-typingW"><div class="stan-typing"><span></span><span></span><span></span></div></div>' +
        '<div class="stan-attach-bar" id="stan-attachBar"></div>' +
        '<div class="stan-input-bar">' +
          '<textarea id="stan-chatInput" placeholder="' + t("chat_placeholder") + '" rows="2"></textarea>' +
          '<div class="stan-bar-row">' +
            '<div style="display:flex;align-items:center;gap:5px;">' +
              '<button class="stan-ba" id="stan-btn-pdf">\ud83d\udd0d ' + t("analyze_pdf") + '</button>' +
              '<button class="stan-ba" id="stan-btn-link">\ud83d\udd17 ' + t("reference_file") + '</button>' +
            '</div>' +
            '<button class="stan-bs" id="stan-sendBtn">' + t("send") + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* Pane: Skills */
      '<div class="stan-pane" id="stan-pane-skills">' +
        '<div class="stan-sk-scroll" id="stan-skillsList"></div>' +
      '</div>' +

      /* Pane: Outputs */
      '<div class="stan-pane" id="stan-pane-outputs">' +
        '<div class="stan-out-header">' +
          '<div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--tl);text-transform:uppercase;margin-bottom:4px;">' + t("outputs") + '</div>' +
          '<p style="font-family:var(--serif);font-size:13px;color:var(--ts);line-height:1.5;margin:0;">' + t("what_is_output") + '</p>' +
        '</div>' +
        '<div class="stan-out-scroll" id="stan-outList">' +
          '<div class="stan-out-empty" id="stan-outEmpty">' +
            '<div class="stan-out-empty-l">' + t("no_outputs") + '</div>' +
            '<div class="stan-out-empty-h">' + t("no_outputs_hint") + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* Pane: History */
      '<div class="stan-pane" id="stan-pane-hist">' +
        '<div class="stan-hist-scroll" id="stan-histList">' +
          '<div class="stan-hist-lbl">' + t("hist_title") + ' \u2014 ' + dealName + '</div>' +
          '<div class="stan-hist-empty" id="stan-histEmpty">' + t("hist_empty") + '</div>' +
        '</div>' +
      '</div>' +

      /* Guide pane (absolute overlay) */
      '<div id="stan-pane-guide" class="stan-pane-guide"></div>';

    layout.appendChild(sb);

    /* Build modals */
    buildModals(layout);

    /* FAB button */
    var fab = document.createElement("button");
    fab.className = "stan-fab";
    fab.id = "stan-fabBtn";
    fab.innerHTML = "Stan \u2192<span class=\"stan-beta-badge\">Beta</span>";
    fab.onclick = openSidebar;
    document.body.appendChild(fab);

    return sb;
  }

  /* ── 7. Build modals ── */
  function buildModals(layout) {
    // Inject chooser modal
    var injectModal = document.createElement("div");
    injectModal.className = "stan-m-ov";
    injectModal.id = "stan-injectModal";
    injectModal.innerHTML =
      '<div class="stan-m-box" style="max-width:500px;border-top-color:var(--green);">' +
        '<div class="stan-m-hd">' +
          '<div><div class="stan-m-ti">' + t("where_inject") + '</div><div class="stan-m-st" id="stan-injectModalSub">' + t("inject_target_label") + '</div></div>' +
          '<button class="stan-m-cls" data-close="stan-injectModal">\u00d7</button>' +
        '</div>' +
        '<div class="stan-m-body" id="stan-injectModalBody"></div>' +
        '<div class="stan-m-ft">' +
          '<button class="stan-mb stan-grn" id="stan-injectConfirmBtn" disabled style="opacity:.4;">' + t("inject_confirm") + '</button>' +
          '<button class="stan-mb stan-out" data-close="stan-injectModal">' + t("cancel") + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(injectModal);

    // Paste modal
    var pasteModal = document.createElement("div");
    pasteModal.className = "stan-m-ov";
    pasteModal.id = "stan-pasteModal";
    pasteModal.innerHTML =
      '<div class="stan-m-box" style="max-width:580px;border-top-color:var(--amber);">' +
        '<div class="stan-m-hd">' +
          '<div><div class="stan-m-ti">' + t("paste_title") + '</div><div class="stan-m-st">' + t("paste_subtitle") + '</div></div>' +
          '<button class="stan-m-cls" data-close="stan-pasteModal">\u00d7</button>' +
        '</div>' +
        '<div class="stan-m-body">' +
          '<div style="background:var(--abg);border:1px solid var(--abr);padding:10px 14px;margin-bottom:14px;font-family:var(--serif);font-size:13px;color:var(--amber);line-height:1.6;">' + t("paste_subtitle") + '</div>' +
          '<textarea id="stan-pasteResultArea" placeholder="..." style="width:100%;min-height:200px;font-family:var(--serif);font-size:14px;padding:10px;border:1px solid var(--border);resize:vertical;line-height:1.65;color:var(--tm);box-sizing:border-box;"></textarea>' +
        '</div>' +
        '<div class="stan-m-ft">' +
          '<button class="stan-mb stan-dark" id="stan-pasteAcceptBtn">' + t("paste_save") + '</button>' +
          '<button class="stan-mb stan-out" data-close="stan-pasteModal">' + t("cancel") + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(pasteModal);

    // Output modal
    var outModal = document.createElement("div");
    outModal.className = "stan-m-ov";
    outModal.id = "stan-outModal";
    outModal.innerHTML =
      '<div class="stan-m-box" id="stan-outBox">' +
        '<div class="stan-m-hd"><div><div class="stan-m-ti" id="stan-outTi">Output</div><div class="stan-m-st">G\u00e9n\u00e9r\u00e9</div></div><button class="stan-m-cls" data-close="stan-outModal">\u00d7</button></div>' +
        '<div class="stan-m-body" id="stan-outBody"></div>' +
        '<div class="stan-m-ft" id="stan-outFt">' +
          '<button class="stan-mb stan-dark" id="stan-shareBtn">' + t("share_url") + '</button>' +
          '<button class="stan-mb stan-grn" id="stan-injectBtn">' + t("inject_memo") + '</button>' +
          '<button class="stan-mb stan-out" data-close="stan-outModal">' + t("close") + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(outModal);

    // History modal
    var histModal = document.createElement("div");
    histModal.className = "stan-m-ov";
    histModal.id = "stan-histModal";
    histModal.innerHTML =
      '<div class="stan-m-box" style="max-width:560px;border-top-color:var(--blue);">' +
        '<div class="stan-m-hd"><div><div class="stan-m-ti">' + t("hist_title") + ' \u00b7 ' + (DEAL_CONTEXT.name || "") + '</div></div><button class="stan-m-cls" data-close="stan-histModal">\u00d7</button></div>' +
        '<div class="stan-m-body" id="stan-histModalBody"><div style="font-family:var(--serif);font-style:italic;font-size:14px;color:var(--tl);">' + t("hist_empty") + '</div></div>' +
        '<div class="stan-m-ft"><button class="stan-mb stan-out" data-close="stan-histModal">' + t("close") + '</button></div>' +
      '</div>';
    document.body.appendChild(histModal);
  }

  /* ── 8. Build skills tab content ── */
  function buildSkillsTab() {
    var container = document.getElementById("stan-skillsList");
    if (!container || !window.SKILLS_TAB_LAYOUT) return;

    var html = '<p style="font-family:var(--serif);font-style:italic;font-size:12px;color:var(--tl);line-height:1.4;padding:8px 16px 8px;">' + t("skills_intro") + '</p>';

    // Directives explanation box
    html += '<div style="background:var(--navy);padding:12px 14px;margin:0 0 4px;">' +
      '<div style="font-family:var(--mono);font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;">Directives \u26a1</div>' +
      '<div style="font-family:var(--serif);font-size:13px;color:#fff;line-height:1.7;">' + t("directives_intro") + '<br>' +
        '<span style="color:rgba(255,200,100,.9);">\ud83d\udccb ' + t("directives_copy_desc") + '</span><br>' +
        '<span style="color:rgba(100,220,150,.9);">\u26a1 ' + t("directives_direct_desc") + '</span>' +
      '</div>' +
    '</div>';

    window.SKILLS_TAB_LAYOUT.forEach(function(group) {
      html += '<div class="stan-sk-ph">' + (group.phase || group.label || "") + '</div>';
      (group.items || []).forEach(function(item) {
        if (item.type === "directive") {
          var dir = window.DIRECTIVES && window.DIRECTIVES[item.key];
          var dirName = item.name || (dir && dir.name) || item.key;
          var dirDesc = item.desc || (dir && dir.description) || "";
          html += '<div class="stan-sk-card" data-directive="' + item.key + '">' +
            '<div style="flex:1;min-width:0;"><div class="stan-sk-nm">' + dirName + '</div><div class="stan-sk-ds">' + dirDesc + '</div></div>' +
            '<div class="stan-sk-arr">\u2192</div>' +
          '</div>';
        } else {
          var name = item.name || (window.SKILL_NAMES && window.SKILL_NAMES[item.key]) || item.key;
          var desc = item.desc || (window.SKILLS && window.SKILLS[item.key]) || "";
          var ico = getSkillIcon(item.key);
          html += '<div class="stan-sk-card" data-skill="' + item.key + '">' +
            '<span class="stan-sk-ico">' + ico + '</span>' +
            '<div><div class="stan-sk-nm">' + name + '</div><div class="stan-sk-ds">' + desc + '</div></div>' +
            '<div class="stan-sk-arr">\u2192</div>' +
          '</div>';
        }
      });
    });

    container.innerHTML = html;
  }

  function getSkillIcon(key) {
    var icons = {
      market: "\ud83d\udd0d", competitive: "\ud83d\uddfa", redflag: "\ud83d\udea8", techaudit: "\u2699\ufe0f",
      techdd: "\u2699\ufe0f", loi: "\ud83d\udccb", callprep: "\ud83d\udcde", email: "\u2709\ufe0f",
      refcheck: "\ud83d\udc64", custref: "\ud83d\udc65", lp: "\ud83d\udcc4", exec: "\ud83d\udcca",
      slides: "\ud83d\udda5", excel: "\ud83d\udcc8", kpi: "\ud83d\udcc9", fairvalue: "\ud83d\udcb0",
      board: "\ud83d\udcdd", "100days": "\ud83d\ude80", "lp-update": "\ud83d\udccb",
      dir07: "\u26a1", dir08: "\u26a1"
    };
    return icons[key] || "\u2192";
  }

  /* ── 9. Build welcome message in chat ── */
  function buildWelcomeMessage() {
    var msgs = document.getElementById("stan-msgs");
    if (!msgs) return;
    msgs.innerHTML =
      '<div class="stan-msg-s" style="border-top-color:var(--navy);">' +
        '<div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--tl);text-transform:uppercase;margin-bottom:8px;">Stan \u2014 Ce que vous pouvez faire ici</div>' +
        '<div style="margin-bottom:10px;">' +
          '<div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--navy);text-transform:uppercase;margin-bottom:4px;">Modifier le m\u00e9mo</div>' +
          '<div style="font-family:var(--serif);font-size:13px;color:var(--tb);line-height:1.6;">' +
            '<em>"R\u00e9\u00e9cris le r\u00e9sum\u00e9 ex\u00e9cutif en insistant sur le moat API"</em><br>' +
            '<em>"Ajoute une section \u00c9quipe avec ces donn\u00e9es : [donn\u00e9es]"</em>' +
          '</div>' +
        '</div>' +
        '<div style="margin-bottom:10px;">' +
          '<div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--navy);text-transform:uppercase;margin-bottom:4px;">Analyser un document</div>' +
          '<div style="font-family:var(--serif);font-size:13px;color:var(--tb);line-height:1.6;">' +
            'Cliquez <strong>' + t("analyze_pdf") + '</strong> puis envoyez.' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--navy);text-transform:uppercase;margin-bottom:4px;">G\u00e9n\u00e9rer un output</div>' +
          '<div style="font-family:var(--serif);font-size:13px;color:var(--tb);line-height:1.6;">' +
            '<em>"G\u00e9n\u00e8re la version LP board-ready"</em><br>' +
            '<em>"R\u00e9dige l\u2019email d\u2019approche fondateur"</em>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ── 10. Build guide pane ── */
  function buildGuide() {
    var el = document.getElementById("stan-pane-guide");
    if (!el) return;
    el.style.display = "none";
    el.innerHTML =
      '<div style="flex:1;overflow-y:auto;padding:14px 16px 24px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">' +
          '<div style="font-family:var(--serif);font-size:1rem;font-weight:700;color:var(--navy);">' + t("guide_title") + '</div>' +
          '<button class="stan-guide-close-btn" style="font-family:var(--serif);font-size:13px;background:transparent;border:1px solid var(--border);color:var(--ts);padding:2px 10px;cursor:pointer;">' + t("guide_close") + '</button>' +
        '</div>' +
        '<div style="font-family:var(--serif);font-style:italic;font-size:13px;color:var(--tl);margin-bottom:16px;line-height:1.5;">' + t("guide_intro") + '</div>' +

        /* Guide cards */
        '<div style="border-left:3px solid var(--navy);padding:10px 14px;margin-bottom:10px;background:var(--off);">' +
          '<div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--navy);text-transform:uppercase;margin-bottom:4px;">\u2460 ' + t("parcours") + '</div>' +
          '<div style="font-family:var(--serif);font-size:14px;color:var(--tb);line-height:1.6;">7 phases de A\u2192Z pour g\u00e9rer ce dossier.</div>' +
          '<button class="stan-guide-nav" data-tab="roadmap" style="font-family:var(--serif);font-size:13px;font-weight:600;background:var(--navy);color:#fff;border:none;padding:5px 14px;cursor:pointer;margin-top:6px;">' + t("parcours") + ' \u2192</button>' +
        '</div>' +
        '<div style="border-left:3px solid #5a3a90;padding:10px 14px;margin-bottom:10px;background:var(--off);">' +
          '<div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.1em;color:#5a3a90;text-transform:uppercase;margin-bottom:4px;">\u2461 ' + t("chat") + '</div>' +
          '<div style="font-family:var(--serif);font-size:14px;color:var(--tb);line-height:1.6;">Donnez des instructions en fran\u00e7ais.</div>' +
          '<button class="stan-guide-nav" data-tab="chat" style="font-family:var(--serif);font-size:13px;font-weight:600;background:#5a3a90;color:#fff;border:none;padding:5px 14px;cursor:pointer;margin-top:6px;">' + t("chat") + ' \u2192</button>' +
        '</div>' +
        '<div style="border-left:3px solid var(--blue);padding:10px 14px;margin-bottom:10px;background:var(--off);">' +
          '<div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--blue);text-transform:uppercase;margin-bottom:4px;">\u2462 ' + t("skills") + '</div>' +
          '<div style="font-family:var(--serif);font-size:14px;color:var(--tb);line-height:1.6;">21 outils organis\u00e9s par phase.</div>' +
          '<button class="stan-guide-nav" data-tab="skills" style="font-family:var(--serif);font-size:13px;font-weight:600;background:var(--blue);color:#fff;border:none;padding:5px 14px;cursor:pointer;margin-top:6px;">' + t("skills") + ' \u2192</button>' +
        '</div>' +
        '<div style="border-left:3px solid var(--green);padding:10px 14px;margin-bottom:16px;background:var(--off);">' +
          '<div style="font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--green);text-transform:uppercase;margin-bottom:4px;">\u2464 ' + t("outputs") + '</div>' +
          '<div style="font-family:var(--serif);font-size:14px;color:var(--tb);line-height:1.6;">' + t("what_is_output") + '</div>' +
          '<button class="stan-guide-nav" data-tab="outputs" style="font-family:var(--serif);font-size:13px;font-weight:600;background:var(--green);color:#fff;border:none;padding:5px 14px;cursor:pointer;margin-top:6px;">' + t("outputs") + ' \u2192</button>' +
        '</div>' +
      '</div>';
  }

  /* ── 11. Map memo sections ── */
  function mapMemoSections() {
    // Add data-stan-section attributes to existing memo sections for injection targeting
    var mappings = [
      { id: "conviction",          stan: "sec-verdict" },
      { id: "market-summary",      stan: "sec-exec" },
      { id: "due-diligence",       stan: "sec-dd" },
      { id: "portfolio-management", stan: "sec-pm" }
    ];
    mappings.forEach(function(m) {
      var el = document.getElementById(m.id);
      if (el) el.setAttribute("data-stan-section", m.stan);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     CORE FUNCTIONS
     ══════════════════════════════════════════════════════════════ */

  /* ── Navigation ── */
  function switchTab(name, btn) {
    var tabs = document.querySelectorAll(".stan-tab");
    var panes = document.querySelectorAll(".stan-pane");
    tabs.forEach(function(t) { t.classList.remove("on"); });
    panes.forEach(function(p) { p.classList.remove("on"); });
    if (btn) btn.classList.add("on");
    else {
      var b = document.getElementById("stan-tab-" + name);
      if (b) b.classList.add("on");
    }
    var pane = document.getElementById("stan-pane-" + name);
    if (pane) pane.classList.add("on");
  }

  function openSidebar() {
    var sb = document.getElementById("stan-sidebar");
    if (sb) sb.classList.remove("closed");
    var fab = document.getElementById("stan-fabBtn");
    if (fab) fab.style.display = "none";
    if (!guideOpen && _firstVisit) {
      _firstVisit = false;
      toggleGuide();
    }
  }

  function closeSidebar() {
    var sb = document.getElementById("stan-sidebar");
    if (sb) sb.classList.add("closed");
    var fab = document.getElementById("stan-fabBtn");
    if (fab) fab.style.display = "";
  }

  function toggleGuide() {
    guideOpen = !guideOpen;
    var el = document.getElementById("stan-pane-guide");
    var pill = document.getElementById("stan-guidePillBtn");
    if (guideOpen) {
      if (el) el.style.display = "flex";
      if (pill) { pill.textContent = "\u00d7"; pill.style.background = "var(--navy)"; pill.style.color = "#fff"; pill.style.borderColor = "var(--navy)"; pill.style.fontStyle = "normal"; }
      openSidebar();
    } else {
      if (el) el.style.display = "none";
      if (pill) { pill.textContent = "?"; pill.style.background = "var(--white)"; pill.style.color = "var(--navy)"; pill.style.borderColor = "var(--navy)"; pill.style.fontStyle = "italic"; }
    }
  }

  function toggleNextAction() {
    var cp = getCurrentPhaseIdx();
    var isOnRoadmap = document.getElementById("stan-pane-roadmap").classList.contains("on");
    if (!isOnRoadmap || !expandedPhases[cp]) {
      nextActOpen = true;
      var na = document.getElementById("stan-nextAct"); if (na) na.classList.add("open");
      var ch = document.getElementById("stan-naChev"); if (ch) ch.textContent = "\u2191";
      switchTab("roadmap");
      expandedPhases[cp] = true;
      renderTimeline();
      setTimeout(function() {
        var hl = document.querySelector(".stan-task-item.stan-next-hl");
        if (hl) hl.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 130);
    } else {
      nextActOpen = false;
      var na2 = document.getElementById("stan-nextAct"); if (na2) na2.classList.remove("open");
      var ch2 = document.getElementById("stan-naChev"); if (ch2) ch2.textContent = "\u2193";
      expandedPhases[cp] = false;
      renderTimeline();
    }
  }

  /* ── Utility ── */
  function flash(id) {
    var el = document.getElementById(id);
    if (!el) {
      // Try fallback
      el = findSection(id);
    }
    if (!el) return;
    el.classList.add("flash");
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(function() { el.classList.remove("flash"); }, 2400);
  }

  function findSection(stanId) {
    // 1. Try direct ID
    var el = document.getElementById(stanId);
    if (el) return el;
    // 2. Try data-stan-section
    el = document.querySelector('[data-stan-section="' + stanId + '"]');
    if (el) return el;
    // 3. Try INJECT_TARGET fallback_id
    if (window.INJECT_TARGET && window.INJECT_TARGET[stanId]) {
      var tgt = window.INJECT_TARGET[stanId];
      if (tgt.fallback_id) el = document.getElementById(tgt.fallback_id);
      if (el) return el;
      // 4. Try comment anchor
      if (tgt.fallback_anchor) {
        var anchored = getElementsBetweenComments(tgt.fallback_anchor + "_START", tgt.fallback_anchor + "_END");
        if (anchored.length) return anchored[0].parentElement || anchored[0];
      }
    }
    return null;
  }

  function getElementsBetweenComments(startText, endText) {
    var result = [];
    function searchNode(node) {
      var children = node.childNodes;
      var collecting = false;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType === 8) {
          var txt = child.data.trim();
          if (txt === startText) { collecting = true; continue; }
          if (txt === endText && collecting) return true;
        }
        if (collecting && child.nodeType === 1) result.push(child);
        if (!collecting && child.nodeType === 1) {
          if (searchNode(child)) return true;
        }
      }
      return false;
    }
    searchNode(document.body);
    return result;
  }

  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove("open");
  }

  function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add("open");
  }

  /* ── Status ── */
  function renderStatusButtons() {
    var nexts = (window.STATUS_FLOW && window.STATUS_FLOW[DEAL_STATUS]) || [];
    var c = document.getElementById("stan-nextBtns");
    var b = document.getElementById("stan-curBadge");
    if (b) {
      b.textContent = DEAL_STATUS;
      b.className = "stan-tpil " + ((window.STATUS_STYLE && window.STATUS_STYLE[DEAL_STATUS]) || "neutral");
    }
    if (!c) return;
    c.innerHTML = "";
    if (!nexts.length) {
      c.innerHTML = '<span style="font-family:var(--mono);font-size:11px;color:var(--tl);">' + t("final_status") + '</span>';
      return;
    }
    nexts.forEach(function(s) {
      var a = document.createElement("a");
      a.href = "javascript:void(0)";
      a.className = "stan-dec " + ((window.STATUS_STYLE && window.STATUS_STYLE[s]) || "neutral");
      a.textContent = (window.STATUS_LABELS && window.STATUS_LABELS[s]) || s;
      a.onclick = function() { openDecision(s); };
      c.appendChild(a);
    });
  }

  function openDecision(status) {
    var ts = new Date().toISOString();
    var id = DEAL_CONTEXT.airtable_record || "";
    var url = "https://forms.proplace.co/t/c2246dXQEVus?status=" + status +
      "&action_timestamp=" + encodeURIComponent(ts) +
      "&user_action_log=" + status +
      "&feedback_reason=no%20feedback&thesis_impact_status=processed&id=" + id;
    window.open(url, "_blank");
    switchTab("chat");
    addMsg('<span style="font-family:var(--mono);font-size:11px;color:var(--green);">\u2192 ' + t("form_opened") + '</span><br><br>Statut <strong>' + status + '</strong> s\u00e9lectionn\u00e9.', "ok");
  }

  /* ── CEO YES/NO decision block ── */
  function buildStatusBlock(status, ceoDecision, ceoNote) {
    var record = (window.DEAL_CONTEXT && window.DEAL_CONTEXT.airtable_record) || "";
    var isAutonomous = status === "CONSIDER" || status === "MONITOR" || status === "PASS";
    var hasCeoDecision = ceoDecision === "YES" || ceoDecision === "NO";

    // CAS 2 — CEO a déjà décidé (prioritaire sur tout le reste)
    if (hasCeoDecision) {
      var decColor = ceoDecision === "YES" ? "#4ac67f" : "#dc2626";
      var decLabel = ceoDecision === "YES" ? "\u2713 YES" : "\u2717 NO";
      var overrideUrl2 = "https://forms.proplace.co/t/c2246dXQEVus?status=CALL" +
        "&action_timestamp=" + new Date().toISOString() +
        "&user_action_log=CALL&feedback_reason=no%20feedback&thesis_impact_status=processed&id=" + record;
      var noteHtml = ceoNote ? ''
        + '<div style="background:#fffbe6;border:1px solid #f0e6a8;border-radius:4px;padding:8px 10px;margin-top:8px">'
        +   '<span style="font-size:8px;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;display:block;margin-bottom:3px">Your note</span>'
        +   '<p style="font-family:Georgia,serif;font-style:italic;font-size:11px;color:#334155;margin:0;line-height:1.55">' + ceoNote + '</p>'
        + '</div>' : "";
      return ''
        + '<div style="margin-bottom:8px">'
        +   '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
        +     '<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase;background:#4ac67f;color:#fff">CALL</span>'
        +     '<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase;background:' + decColor + ';color:#fff">' + decLabel + '</span>'
        +     '<button onclick="stanEditDecision()" style="font-size:9px;color:#64748b;background:transparent;border:1px solid #e2e8f0;border-radius:3px;padding:3px 8px;cursor:pointer;font-family:monospace;text-transform:uppercase">\u270f Modify</button>'
        +   '</div>'
        +   noteHtml
        +   '<div style="text-align:right;margin-top:4px">'
        +     '<a href="' + overrideUrl2 + '" target="_blank" style="font-size:9px;color:#94a3b8;text-decoration:underline">Override \u2192</a>'
        +   '</div>'
        + '</div>';
    }

    // CAS 1 — verdict autonome Stan (CONSIDER / MONITOR / PASS uniquement)
    if (isAutonomous) {
      var col = STATUS_COLORS[status] || { bg: "#94a3b8", text: "#fff" };
      var overrideUrl1 = "https://forms.proplace.co/t/c2246dXQEVus?status=" + status +
        "&action_timestamp=" + new Date().toISOString() +
        "&user_action_log=" + status +
        "&feedback_reason=no%20feedback&thesis_impact_status=processed&id=" + record;
      return ''
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
        +   '<div>'
        +     '<span style="font-size:8px;color:#94a3b8;font-family:monospace;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:2px">Stan decided autonomously</span>'
        +     '<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;background:' + col.bg + ';color:' + col.text + '">'
        +       status
        +     '</span>'
        +   '</div>'
        +   '<a href="' + overrideUrl1 + '" target="_blank" style="font-size:9px;color:#94a3b8;text-decoration:underline">Override \u2192</a>'
        + '</div>';
    }

    // CAS 3 — CALL (ou NEW) en attente de décision CEO
    return ''
      + '<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 11px;border-radius:0 4px 4px 0;margin-bottom:10px">'
      +   '<span style="font-size:9px;font-weight:700;color:#ca8a04;font-family:monospace;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:2px">'
      +     '\u23f3 Stan\'s top pick \u2014 your decision'
      +   '</span>'
      +   '<span style="font-size:10px;color:#64748b">Stan identified this as a particularly interesting opportunity. YES or NO.</span>'
      + '</div>'
      + '<div id="stan-yes-no-block">'
      +   '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:7px"><tr>'
      +     '<td width="48%" style="padding-right:5px">'
      +       '<button id="stan-btn-yes" onclick="stanHandleDecision(\'YES\')" style="display:block;width:100%;padding:11px 0;text-align:center;font-size:13px;font-weight:800;text-transform:uppercase;border-radius:4px;box-sizing:border-box;background:#4ac67f;color:#fff;border:none;letter-spacing:1px;cursor:pointer">'
      +         '\u2713 YES'
      +       '</button>'
      +     '</td>'
      +     '<td width="4%" style="text-align:center"><span style="color:#cbd5e1;font-size:12px">|</span></td>'
      +     '<td width="48%" style="padding-left:5px">'
      +       '<button id="stan-btn-no" onclick="stanHandleDecision(\'NO\')" style="display:block;width:100%;padding:11px 0;text-align:center;font-size:13px;font-weight:800;text-transform:uppercase;border-radius:4px;box-sizing:border-box;background:#fff;color:#dc2626;border:2px solid #dc2626;letter-spacing:1px;cursor:pointer">'
      +         '\u2717 NO'
      +       '</button>'
      +     '</td>'
      +   '</tr></table>'
      +   '<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px"><tr>'
      +     '<td width="48%" style="text-align:center;padding-right:5px"><p style="font-size:10px;color:#64748b;margin:0">You reach out, or <a href="#" style="color:#4ac67f;font-weight:700;text-decoration:underline">we do it for you</a></p></td>'
      +     '<td width="4%"></td>'
      +     '<td width="48%" style="text-align:center;padding-left:5px"><p style="font-size:10px;color:#94a3b8;margin:0">Stan recalibrates thesis</p></td>'
      +   '</tr></table>'
      + '</div>'
      + '<div id="stan-note-box" style="display:none"></div>';
  }

  function stanRenderStatusBlock() {
    var container = document.getElementById("stan-status-block");
    if (!container) return;
    container.innerHTML = buildStatusBlock(
      (window.DEAL_CONTEXT && window.DEAL_CONTEXT.status) || DEAL_STATUS || "CALL",
      (window.DEAL_CONTEXT && window.DEAL_CONTEXT.ceo_decision) || null,
      (window.DEAL_CONTEXT && window.DEAL_CONTEXT.ceo_note) || null
    );
    stanUpdateTopPill();
  }

  // Display status for the top-right pill = what the body is showing:
  //   CEO decided (YES/NO) OR status is CALL/NEW → "CALL"
  //   status is CONSIDER / MONITOR / PASS → the real status
  function stanDisplayStatus() {
    var ctx = window.DEAL_CONTEXT || {};
    if (ctx.ceo_decision === "YES" || ctx.ceo_decision === "NO") return "CALL";
    if (ctx.status === "CONSIDER" || ctx.status === "MONITOR" || ctx.status === "PASS") return ctx.status;
    return "CALL";
  }

  function stanUpdateTopPill() {
    var b = document.getElementById("stan-curBadge");
    if (!b) return;
    var ds = stanDisplayStatus();
    b.textContent = ds;
    b.className = "stan-tpil " + ((window.STATUS_STYLE && window.STATUS_STYLE[ds]) || "call");
  }

  function stanHandleDecision(decision) {
    _stanPendingDecision = decision;
    var yesNoBlock = document.getElementById("stan-yes-no-block");
    if (yesNoBlock) yesNoBlock.style.display = "none";

    var record = window.DEAL_CONTEXT && window.DEAL_CONTEXT.airtable_record;
    if (!record) { console.error("Stan: no airtable_record in DEAL_CONTEXT"); return; }

    // PATCH immédiat (ceo_decision + ceo_decision_date)
    fetch(AIRTABLE_BRIDGE_URL + "/stan-state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        record_id: record,
        ceo_decision: decision,
        ceo_decision_date: new Date().toISOString().split("T")[0],
      }),
    }).catch(function(e) { console.error("Stan: immediate PATCH failed", e); });

    // Update local context immediately for UX (note box still open)
    window.DEAL_CONTEXT = Object.assign({}, window.DEAL_CONTEXT || {}, { ceo_decision: decision });

    stanShowNoteBox(decision);
  }

  function stanShowNoteBox(decision) {
    var isNo = decision === "NO";
    var box = document.getElementById("stan-note-box");
    if (!box) return;

    box.style.display     = "block";
    box.style.background  = isNo ? "#fff8f8" : "#f0fdf4";
    box.style.border      = "1px solid " + (isNo ? "#fecaca" : "#bbf7d0");
    box.style.borderRadius = "6px";
    box.style.padding     = "12px 14px";
    box.style.marginTop   = "10px";

    box.innerHTML = ''
      + '<style>#stan-ceo-note::placeholder{font-style:normal;color:#94a3b8;font-family:Georgia,serif;font-size:13px;}</style>'
      + '<p style="font-size:13px;font-weight:700;color:' + (isNo ? "#dc2626" : "#166534") + ';margin:0 0 10px 0;font-family:monospace;text-transform:uppercase;letter-spacing:.04em">'
      +   (isNo ? "\u2717 NO saved \u2014 Stan will recalibrate." : "\u2713 YES saved \u2014 Stan is on it.")
      + '</p>'
      + '<p style="font-size:12px;color:#475569;margin:0 0 6px 0">Your note (optional)</p>'
      + '<textarea id="stan-ceo-note" placeholder="' + (isNo ? "e.g. Founders too junior, wrong B2C focus..." : "e.g. API-native, founder ex-Amadeus...") + '" rows="2" style="width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:4px;padding:8px 10px;font-size:14px;font-family:Georgia,serif;font-style:normal;color:#0f172a;line-height:1.55;resize:none;outline:none;background:#fff"></textarea>'
      + '<div style="display:flex;gap:8px;margin-top:10px">'
      +   '<button onclick="stanSaveCeoDecision()" style="flex:1;padding:9px 0;background:' + (isNo ? "#dc2626" : "#4ac67f") + ';color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:.06em">Save</button>'
      +   '<button onclick="stanSkipCeoNote()" style="padding:9px 16px;background:#f8fafc;color:#64748b;border:1px solid #e2e8f0;border-radius:4px;font-size:12px;cursor:pointer">Skip</button>'
      + '</div>'
      + (isNo ? '<p style="font-size:11px;color:#94a3b8;margin:8px 0 0 0;font-style:italic">One line doubles Stan\'s convergence speed on this angle.</p>' : "");

    setTimeout(function() { var ta = document.getElementById("stan-ceo-note"); if (ta) ta.focus(); }, 80);
  }

  async function stanSaveCeoDecision() {
    var noteEl = document.getElementById("stan-ceo-note");
    var note = noteEl ? noteEl.value.trim() : "";
    await stanPersistCeoDecision(_stanPendingDecision, note);
  }

  async function stanSkipCeoNote() {
    await stanPersistCeoDecision(_stanPendingDecision, "");
  }

  async function stanPersistCeoDecision(decision, note) {
    var record = window.DEAL_CONTEXT && window.DEAL_CONTEXT.airtable_record;
    var company = (window.DEAL_CONTEXT && window.DEAL_CONTEXT.company_name) || "";
    var origNcl = (window.DEAL_CONTEXT && window.DEAL_CONTEXT.neural_command_line_final) || "";

    if (!record) { console.error("Stan: no airtable_record in DEAL_CONTEXT"); return; }

    var ceoNcl = "";
    try {
      if (note) {
        var res = await fetch(STAN_PROXY_URL + "/ceo-signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: decision,
            note: note,
            company: company,
            angle_id: (window.DEAL_CONTEXT && window.DEAL_CONTEXT.angle_id) || "",
            original_ncl: origNcl,
          }),
        });
        if (res.ok) {
          var data = await res.json();
          ceoNcl = data.ceo_ncl || "";
        }
      } else if (decision === "NO") {
        ceoNcl = "\ud83d\udd34 CEO_VETO: " + company + " \u00b7 angle:unknown \u00b7 TOXIC_KEYWORD: profile_rejected \u00b7 NARRATIVE_INSIGHT: CEO rejected Stan's top pick without providing a specific reason.";
      } else {
        ceoNcl = origNcl;
      }

      var fields = {};
      if (note) fields.ceo_note = note;
      if (ceoNcl) fields.ceo_ncl = ceoNcl;

      if (Object.keys(fields).length > 0) {
        fields.record_id = record;
        await fetch(AIRTABLE_BRIDGE_URL + "/stan-state", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
      }
    } catch (err) {
      console.error("Stan: CEO decision note save failed", err);
    }

    window.DEAL_CONTEXT = Object.assign({}, window.DEAL_CONTEXT || {}, {
      ceo_decision: decision,
      ceo_note: note || null,
      ceo_ncl: ceoNcl || null,
    });

    stanRenderStatusBlock();
  }

  function stanEditDecision() {
    window.DEAL_CONTEXT = Object.assign({}, window.DEAL_CONTEXT || {}, {
      ceo_decision: null,
      ceo_note: null,
    });
    stanRenderStatusBlock();
  }

  // Expose for inline onclick handlers
  window.stanHandleDecision   = stanHandleDecision;
  window.stanSaveCeoDecision  = stanSaveCeoDecision;
  window.stanSkipCeoNote      = stanSkipCeoNote;
  window.stanEditDecision     = stanEditDecision;

  /* ── Task Management ── */
  window.stanCompleteTask = function(tid) { completeTask(tid); };

  function completeTask(tid) {
    for (var i = 0; i < PHASES.length; i++) {
      for (var j = 0; j < PHASES[i].tasks.length; j++) {
        if (PHASES[i].tasks[j].id === tid) {
          PHASES[i].tasks[j].done = true;
          break;
        }
      }
    }
    renderTimeline();
    updateProgress();
    updateNextAction();
    persistStanState();
  }

  function toggleTask(pi, ti) {
    PHASES[pi].tasks[ti].done = !PHASES[pi].tasks[ti].done;
    renderTimeline();
    updateProgress();
    updateNextAction();
    persistStanState();
  }

  function calcProgress() {
    var total = 0, done = 0;
    PHASES.forEach(function(p) {
      p.tasks.forEach(function(tk) { if (tk.req) { total++; if (tk.done) done++; } });
    });
    return total ? Math.round(done / total * 100) : 0;
  }

  function getCurrentPhaseIdx() {
    for (var i = 0; i < PHASES.length; i++) {
      if (PHASES[i].tasks.filter(function(t) { return t.req && !t.done; }).length > 0) return i;
    }
    return PHASES.length - 1;
  }

  function updateProgress() {
    var pct = calcProgress(), cp = getCurrentPhaseIdx() + 1;
    var fill = document.getElementById("stan-rmFill");
    if (fill) fill.style.width = pct + "%";
    var pctEl = document.getElementById("stan-rmPct");
    if (pctEl) pctEl.textContent = pct + "%";
    var title = document.getElementById("stan-rmTitle");
    if (title) title.textContent = "Phase " + cp + "/" + PHASES.length + " \u00b7 " + PHASES[cp - 1].name;
    var p2 = PHASES[cp - 1];
    var rd = p2.tasks.filter(function(t) { return t.req && t.done; }).length;
    var rt = p2.tasks.filter(function(t) { return t.req; }).length;
    var sub = document.getElementById("stan-rmSub");
    if (sub) sub.textContent = pct + "% " + t("tasks_completed") + " \u00b7 " + (rt - rd) + " " + t("tasks_remaining");
    renderStatusButtons();
  }

  function updateNextAction() {
    var cp = getCurrentPhaseIdx();
    var nxt = PHASES[cp].tasks.find(function(t) { return !t.done; });
    var naTxt = document.getElementById("stan-naTxt");
    if (naTxt) {
      naTxt.textContent = nxt ? nxt.label : t("phase_complete") + ' "' + PHASES[cp].name + '"';
    }
  }

  /* ── Timeline ── */
  function renderTimeline() {
    var cp = getCurrentPhaseIdx();
    var el = document.getElementById("stan-timelineEl");
    if (!el) return;
    el.innerHTML = "";

    PHASES.forEach(function(phase, pi) {
      var isLast = pi === PHASES.length - 1;
      var rd = phase.tasks.filter(function(t) { return t.req && t.done; }).length;
      var rt = phase.tasks.filter(function(t) { return t.req; }).length;
      var allDone = rd === rt;
      var isComp = allDone && pi < cp;
      var isCur = pi === cp;
      var isLocked = pi > cp && phase.locked !== false;
      if (!expandedPhases.hasOwnProperty(pi)) expandedPhases[pi] = isCur;
      var isOpen = !!expandedPhases[pi];

      var item = document.createElement("div"); item.className = "stan-tl-item";
      var lc = document.createElement("div"); lc.className = "stan-tl-line";
      var dot = document.createElement("div"); dot.className = "stan-tl-dot " + (isComp ? "done" : isCur ? "current" : "locked");
      lc.appendChild(dot);
      if (!isLast) { var conn = document.createElement("div"); conn.className = "stan-tl-conn " + (isComp ? "done" : isCur ? "current" : ""); lc.appendChild(conn); }
      item.appendChild(lc);

      var content = document.createElement("div"); content.className = "stan-tl-content" + (isCur ? " current" : "");
      var hd = document.createElement("div"); hd.className = "stan-ph-hd" + (isLocked ? " locked" : "");
      var left = document.createElement("div"); left.className = "stan-ph-left";
      var chev = document.createElement("span"); chev.className = "stan-ph-chev";
      chev.textContent = isLocked ? "" : isOpen ? "\u25be" : "\u25b8";
      var nm = document.createElement("div");
      nm.className = "stan-ph-nm " + (isComp ? "done" : isCur ? "current" : "locked");
      nm.textContent = phase.icon + " " + phase.name;
      left.appendChild(chev); left.appendChild(nm);
      var bdg = document.createElement("span");
      bdg.className = "stan-ph-bdg " + (isComp ? "done" : isCur ? "current" : "locked");
      bdg.textContent = isComp ? "\u2713" : isCur ? (rd + "/" + rt) : "\ud83d\udd12";
      hd.appendChild(left); hd.appendChild(bdg);

      if (!isLocked) {
        (function(idx) { hd.onclick = function() { expandedPhases[idx] = !expandedPhases[idx]; renderTimeline(); updateNextAction(); }; })(pi);
        hd.style.cursor = "pointer";
      }
      content.appendChild(hd);

      var sts = document.createElement("div"); sts.className = "stan-ph-sts"; sts.textContent = phase.statuses;
      content.appendChild(sts);

      if (!isLocked && isOpen) {
        var tl = document.createElement("div"); tl.className = "stan-task-list open";
        phase.tasks.forEach(function(tk, ti) {
          var tiel = document.createElement("div");
          tiel.className = "stan-task-item" + (tk.done ? " done" : "");
          tiel.id = "stan-task-" + tk.id;
          (function(p2, t2) { tiel.onclick = function() { toggleTask(p2, t2); }; })(pi, ti);

          var cb = document.createElement("div"); cb.className = "stan-task-cb";
          var ck = document.createElement("span"); ck.className = "stan-task-ck"; ck.textContent = "\u2713";
          cb.appendChild(ck);

          var right = document.createElement("div"); right.className = "stan-task-right";
          var lbl = document.createElement("div"); lbl.className = "stan-task-lbl";
          lbl.textContent = tk.label + (tk.auto ? " " + t("auto_label") : "");
          var meta2 = document.createElement("div"); meta2.className = "stan-task-meta";
          var req = document.createElement("span");
          req.className = "stan-t-req " + (tk.req ? "r" : "o");
          req.textContent = tk.req ? t("mandatory") : t("optional");
          meta2.appendChild(req);

          if (tk.skill && !tk.done) {
            var sb2 = document.createElement("button"); sb2.className = "stan-t-stan";
            sb2.textContent = tk.skillName || "Stan";
            (function(sk) { sb2.onclick = function(e) { e.stopPropagation(); sc(sk); }; })(tk.skill);
            meta2.appendChild(sb2);
          }
          right.appendChild(lbl); right.appendChild(meta2);
          tiel.appendChild(cb); tiel.appendChild(right);
          tl.appendChild(tiel);
        });
        content.appendChild(tl);

        if (isCur && !isLast) {
          var pr = document.createElement("div"); pr.className = "stan-ph-prog";
          var pt = document.createElement("span"); pt.className = "stan-ph-prog-txt";
          pt.textContent = rd + "/" + rt + " " + t("mandatory");
          pr.appendChild(pt);
          if (allDone) {
            var av = document.createElement("button"); av.className = "stan-ph-adv";
            av.textContent = t("next_phase");
            (function(pIdx) {
              av.onclick = function() {
                if (PHASES[pIdx + 1]) PHASES[pIdx + 1].locked = false;
                expandedPhases[pIdx] = false;
                expandedPhases[pIdx + 1] = true;
                updateProgress(); renderTimeline(); updateNextAction();
                addMsg('<span style="font-family:var(--mono);font-size:11px;color:var(--green);">\u2192 ' + PHASES[pIdx + 1].name + ' d\u00e9bloqu\u00e9e.</span>', "ok");
              };
            })(pi);
            pr.appendChild(av);
          }
          content.appendChild(pr);
        }
      }
      item.appendChild(content); el.appendChild(item);
    });

    // Re-highlight next task
    var cp2 = getCurrentPhaseIdx();
    var nxt = PHASES[cp2].tasks.find(function(t) { return !t.done; });
    if (nxt) {
      var hl = document.getElementById("stan-task-" + nxt.id);
      if (hl) hl.classList.add("stan-next-hl");
    }
  }

  /* ── Chat ── */
  function addMsg(html, cls) {
    var m = document.getElementById("stan-msgs");
    var d = document.createElement("div");
    d.className = "stan-msg-s " + (cls || "");
    d.innerHTML = html;
    m.appendChild(d);
    m.scrollTop = m.scrollHeight;
    return d;
  }

  function addUser(txt) {
    var m = document.getElementById("stan-msgs");
    var d = document.createElement("div");
    d.className = "stan-msg-u";
    d.textContent = txt;
    m.appendChild(d);
    m.scrollTop = m.scrollHeight;
  }

  function addFups(el, fus) {
    if (!fus || !fus.length) return;
    var d = document.createElement("div"); d.className = "stan-fups";
    fus.forEach(function(f) {
      var b = document.createElement("button"); b.className = "stan-fup";
      if (typeof f === "object" && f.label) {
        b.textContent = f.label;
        if (f.tab) {
          (function(tab) { b.onclick = function() { switchTab(tab); }; })(f.tab);
        } else if (f.skill) {
          (function(sk) { b.onclick = function() { sc(sk); }; })(f.skill);
        } else if (f.share) {
          b.onclick = function() { shareOutput(); };
        } else if (f.inject) {
          (function(key) { b.onclick = function() { injectKey(key); }; })(f.inject);
        } else if (f.directive) {
          (function(did) { b.onclick = function() { launchDirective(did); }; })(f.directive);
        } else if (f.fn) {
          b.onclick = f.fn;
        } else {
          (function(txt) { b.onclick = function() { var inp = document.getElementById("stan-chatInput"); inp.value = txt; sendMsg(); }; })(f.label);
        }
      } else {
        var txt2 = typeof f === "string" ? f : "";
        b.textContent = txt2;
        (function(t2) { b.onclick = function() { var inp = document.getElementById("stan-chatInput"); inp.value = t2; sendMsg(); }; })(txt2);
      }
      d.appendChild(b);
    });
    el.appendChild(d);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  }

  function simAttach(type) {
    attached.push({ name: type === "pdf" ? "document.pdf" : "fichier.xlsx", type: type });
    renderAttach();
    var inp = document.getElementById("stan-chatInput");
    if (type === "pdf") {
      inp.value = "";
      inp.placeholder = t("pdf_placeholder");
    } else {
      inp.value = t("link_prefill");
      inp.placeholder = t("link_placeholder");
    }
    inp.focus();
  }

  function renderAttach() {
    var b = document.getElementById("stan-attachBar");
    b.innerHTML = attached.map(function(a, i) {
      return '<div class="stan-chip">' + (a.type === "pdf" ? "PDF" : "XLSX") + " \u00b7 " + a.name + ' <button data-rm-attach="' + i + '">\u00d7</button></div>';
    }).join("");
  }

  /* ── Skill execution ── */
  async function sc(key) {
    // Check if it's a directive
    if (window.DIRECTIVES && window.DIRECTIVES[key]) {
      launchDirective(key);
      return;
    }

    switchTab("chat");
    var displayName = (window.SKILL_NAMES && window.SKILL_NAMES[key]) || key;
    addUser(displayName);

    var direct = window.SKILL_DIRECT && window.SKILL_DIRECT[key];
    var tw = document.getElementById("stan-typingW");
    tw.classList.add("show");
    document.getElementById("stan-msgs").scrollTop = 99999;

    if (direct) {
      try {
        var memoEl = document.querySelector(".stan-main") || document.body;
        var memoHtml = memoEl.innerHTML || "";

        var response = await fetch(MODAL_BASE + "stan-skills-fastapi-app.modal.run/skill/" + key, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: DEAL_CONTEXT.name || "",
            arr: DEAL_CONTEXT.arr || "",
            ev: DEAL_CONTEXT.ev || "",
            lang: window.STAN_LANG || "fr",
            memo_html: memoHtml
          })
        });

        var result = await response.json();
        tw.classList.remove("show");

        if (result.error) {
          addMsg("<strong>Erreur :</strong> " + result.error, "");
          return;
        }

        if (direct.run) direct.run();

        if (result.output_html && direct.out) {
          var outData = { title: result.output_title || displayName, html: result.output_html };
          window.OUT_CONTENT[direct.out] = outData;
          pendingOut = { key: direct.out, data: outData };
          saveOutput(direct.out, outData);
        }

        if (result.task_to_complete) completeTask(result.task_to_complete);

        var el = addMsg(result.chat_html || ("<strong>" + displayName + " \u2014 termin\u00e9.</strong>"), "ok");
        addFups(el, direct.f || []);
        document.getElementById("stan-msgs").scrollTop = 99999;

        await persistStanState();
      } catch (err) {
        tw.classList.remove("show");
        addMsg("<strong>Erreur r\u00e9seau.</strong> V\u00e9rifiez la connexion et r\u00e9essayez.", "");
        console.error("Stan skill error:", err);
      }
    } else {
      setTimeout(function() {
        tw.classList.remove("show");
        var el = addMsg(t("fallback_msg"), "ok");
        addFups(el, [{ label: t("nav_roadmap"), tab: "roadmap" }, { label: t("nav_skills"), tab: "skills" }]);
        document.getElementById("stan-msgs").scrollTop = 99999;
      }, 1400);
    }
  }


  function applyMemoEdits(edits) {
    var target = document.querySelector(".stan-main") || document.body;
    var applied = 0;
    edits.forEach(function(e) {
      var find = e.find, replace = e.replace;
      if (!find) return;
      var walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, null);
      var nodes = [], n;
      while ((n = walker.nextNode())) nodes.push(n);
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.nodeValue && node.nodeValue.indexOf(find) !== -1) {
          node.nodeValue = node.nodeValue.split(find).join(replace || "");
          applied++;
          if (node.parentElement) {
            var el = node.parentElement;
            el.style.transition = "background 1.2s ease";
            var prev = el.style.background;
            el.style.background = "rgba(255,220,100,.5)";
            setTimeout(function(el, prev) { return function() { el.style.background = prev; }; }(el, prev), 1500);
          }
          break;
        }
      }
    });
    if (applied > 0 && typeof pushCommitToGitHub === "function") {
      try { pushCommitToGitHub("Chat edit via Stan"); } catch (_) {}
    }
    return applied;
  }

  async function sendMsg() {
    var inp = document.getElementById("stan-chatInput");
    var txt = inp.value.trim();
    if (!txt && !attached.length) return;
    if (attached.length && !txt) txt = t("analyze_default");
    inp.value = "";
    var sendBtn = document.getElementById("stan-sendBtn");
    if (sendBtn) sendBtn.disabled = true;
    addUser(txt + (attached.length ? " [\ud83d\udcce " + attached[0].name + "]" : ""));
    attached = [];
    renderAttach();

    var tw = document.getElementById("stan-typingW");
    tw.classList.add("show");
    document.getElementById("stan-msgs").scrollTop = 99999;

    try {
      var memoEl = document.querySelector(".stan-main") || document.body;
      var memoHtml = memoEl.innerHTML || "";

      var response = await fetch(MODAL_BASE + "stan-skills-fastapi-app.modal.run/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: txt,
          company_name: DEAL_CONTEXT.name || "",
          memo_html: memoHtml
        })
      });

      var result = await response.json();
      tw.classList.remove("show");

      if (result.error) {
        addMsg("<strong>Erreur :</strong> " + result.error, "");
      } else {
        addMsg(result.chat_html || t("fallback_msg"), "ok");
        if (Array.isArray(result.edits) && result.edits.length) {
          var applied = applyMemoEdits(result.edits);
          if (applied > 0) {
            pushHist("Chat edit : " + applied + " modification(s) appliqu\u00e9e(s)");
          } else {
            addMsg("<em>\u26a0\ufe0f Texte \u00e0 remplacer introuvable dans le m\u00e9mo.</em>", "");
          }
        }
      }
    } catch (err) {
      tw.classList.remove("show");
      addMsg("<strong>Erreur r\u00e9seau.</strong> V\u00e9rifiez la connexion et r\u00e9essayez.", "");
      console.error("Stan chat error:", err);
    }

    if (sendBtn) sendBtn.disabled = false;
    document.getElementById("stan-msgs").scrollTop = 99999;
  }

  /* ── History ── */
  function snapshotMemo() {
    var target = document.querySelector(".stan-main") || document.getElementById("memo-content");
    return target ? target.innerHTML : "";
  }

  function pushHist(msg) {
    var time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    historyItems.unshift({ t: time, msg: msg, snapshot: snapshotMemo() });
    renderHist();
    pushCommitToGitHub(msg);
  }

  function restoreHist(idx) {
    var h = historyItems[idx];
    if (!h || !h.snapshot) { alert("Pas de snapshot disponible pour cette entr\u00e9e."); return; }
    if (!confirm("Restaurer le m\u00e9mo \u00e0 l'\u00e9tat : \"" + h.msg + "\" (" + h.t + ") ?")) return;
    var target = document.querySelector(".stan-main") || document.getElementById("memo-content");
    if (target) {
      target.innerHTML = h.snapshot;
      pushCommitToGitHub("Restauration : " + h.msg);
      alert("M\u00e9mo restaur\u00e9.");
    }
  }

  function renderHist() {
    var l = document.getElementById("stan-histList");
    var e = document.getElementById("stan-histEmpty");
    if (e && historyItems.length) e.style.display = "none";
    if (!l) return;
    l.querySelectorAll(".stan-hist-item").forEach(function(i) { i.remove(); });
    historyItems.forEach(function(h, idx) {
      var d = document.createElement("div"); d.className = "stan-hist-item";
      d.innerHTML =
        '<div class="stan-hist-t">' + h.t + '</div>' +
        '<div class="stan-hist-msg">' + h.msg + '</div>' +
        '<div class="stan-hist-btns">' +
          '<button class="stan-hb" data-act="diff" data-idx="' + idx + '">' + t("hist_view_diff") + '</button>' +
          '<button class="stan-hb" data-act="restore" data-idx="' + idx + '">' + t("hist_restore") + '</button>' +
        '</div>';
      d.querySelectorAll(".stan-hb").forEach(function(btn) {
        btn.addEventListener("click", function() {
          var act = btn.getAttribute("data-act");
          var i = parseInt(btn.getAttribute("data-idx"), 10);
          if (act === "restore") restoreHist(i);
          else if (act === "diff") {
            var item = historyItems[i];
            alert("Snapshot du " + item.t + " \u2014 " + (item.snapshot ? item.snapshot.length + " caract\u00e8res" : "aucun snapshot"));
          }
        });
      });
      l.appendChild(d);
    });
  }

  /* ── Outputs ── */
  function saveOutput(key, data) {
    var time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    var phaseNum = (window.SKILL_PHASE && window.SKILL_PHASE[key]) || getCurrentPhaseIdx() + 1;
    var phaseName = PHASES[phaseNum - 1] ? PHASES[phaseNum - 1].name : "";
    savedOutputs.unshift({ key: key, title: data.title, time: time, status: "saved", phase: phaseName, phaseNum: phaseNum });
    renderOutputs();
    var b = document.getElementById("stan-outBdg");
    if (b) { b.style.display = "flex"; b.textContent = savedOutputs.length; }
    pushHist(data.title + " g\u00e9n\u00e9r\u00e9 \u00b7 Phase " + phaseNum);
  }

  function renderOutputs() {
    var l = document.getElementById("stan-outList");
    var e = document.getElementById("stan-outEmpty");
    if (e && savedOutputs.length) e.style.display = "none";
    if (!l) return;
    l.querySelectorAll(".stan-out-item").forEach(function(i) { i.remove(); });
    var STANDALONE = window.STANDALONE_OUTPUTS || ["email", "lp", "slides"];

    savedOutputs.forEach(function(o, i) {
      var isStandalone = STANDALONE.indexOf(o.key) !== -1;
      var statusTxt = o.status === "inject\u00e9" ? t("injected") :
                      o.status === "partag\u00e9" ? t("shared") : t("saved");
      if (isStandalone && o.status !== "partag\u00e9") statusTxt = t("standalone_label");
      var statusColor = o.status === "inject\u00e9" ? "var(--green)" :
                        o.status === "partag\u00e9" ? "var(--blue)" : "var(--tl)";

      var injectBtn = isStandalone
        ? '<button class="stan-ob" style="color:var(--tl);cursor:default;" title="' + t("not_injectable_msg") + '">' + t("not_injectable") + '</button>'
        : '<button class="stan-ob" data-qi="' + i + '">' + t("inject_memo") + '</button>';

      var d = document.createElement("div"); d.className = "stan-out-item";
      d.innerHTML =
        '<div class="stan-out-meta">Phase ' + o.phaseNum + ' \u00b7 ' + o.phase + '</div>' +
        '<div class="stan-out-title">' + o.title + '</div>' +
        '<div style="font-family:var(--mono);font-size:10px;color:' + statusColor + ';margin-bottom:7px;">' + o.time + ' \u00b7 ' + statusTxt + '</div>' +
        '<div class="stan-out-btns">' +
          '<button class="stan-ob pr" data-out-view="' + o.key + '">' + t("view") + '</button>' +
          '<button class="stan-ob" data-qs="' + i + '">' + t("share_url") + '</button>' +
          injectBtn +
        '</div>';
      l.appendChild(d);
    });
  }

  function openOutModal(key) {
    var d = window.OUT_CONTENT[key]; if (!d) return;
    pendingOut = { key: key, data: d };
    var ti = document.getElementById("stan-outTi"); if (ti) ti.textContent = d.title;
    var ctx = (window.OUT_CONTEXT && window.OUT_CONTEXT[key]) || "";
    var ctxHtml = ctx ? '<div style="background:var(--off);border-left:2px solid var(--border-l);padding:8px 12px;margin-bottom:16px;font-family:var(--serif);font-style:italic;font-size:13px;color:var(--ts);line-height:1.5;">' + ctx + '</div>' : "";
    var body = document.getElementById("stan-outBody");
    if (body) body.innerHTML = ctxHtml + d.html;

    // Reset footer buttons
    var ft = document.getElementById("stan-outFt");
    if (ft) {
      ft.innerHTML =
        '<button class="stan-mb stan-dark" id="stan-shareBtn">' + t("share_url") + '</button>' +
        '<button class="stan-mb stan-grn" id="stan-injectBtn">' + t("inject_memo") + '</button>' +
        '<button class="stan-mb stan-out" data-close="stan-outModal">' + t("close") + '</button>';
      // Re-wire buttons
      var shareBtn = document.getElementById("stan-shareBtn");
      if (shareBtn) shareBtn.onclick = shareOutput;
      var injBtn = document.getElementById("stan-injectBtn");
      if (injBtn) injBtn.onclick = injectOutput;
    }

    openModal("stan-outModal");
  }

  function shareOutput() {
    var tok = Math.random().toString(36).slice(2, 10);
    var url = "https://analysis.proplace.co/output?t=" + tok;
    if (pendingOut) {
      var idx = savedOutputs.findIndex(function(o) { return o.key === pendingOut.key; });
      if (idx >= 0) { savedOutputs[idx].status = "partag\u00e9"; savedOutputs[idx].url = url; }
      renderOutputs();
    }
    openModal("stan-outModal");
    var urlHtml = '<div style="background:var(--gbg);border:1px solid var(--gbr);padding:12px 16px;margin-bottom:14px;">' +
      '<div style="font-family:var(--mono);font-size:10px;color:var(--green);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">\u2713 ' + t("share_created") + '</div>' +
      '<a href="' + url + '" target="_blank" style="font-family:var(--mono);font-size:12px;color:var(--blue);display:block;margin-bottom:6px;word-break:break-all;">' + url + '</a>' +
      '</div>';
    var body = document.getElementById("stan-outBody");
    if (body) body.innerHTML = urlHtml + (body.innerHTML || "");
    pushHist((pendingOut ? pendingOut.data.title : "Output") + " partag\u00e9");
  }

  function injectOutput() {
    if (!pendingOut) return;
    if ((window.STANDALONE_OUTPUTS || []).indexOf(pendingOut.key) !== -1) {
      // Standalone — explain
      var msg = '<div style="background:var(--off);border-left:2px solid var(--border);padding:10px 14px;margin-bottom:14px;">' +
        '<div style="font-family:var(--mono);font-size:10px;color:var(--tl);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;">' + t("standalone_explain") + '</div>' +
        '<div style="font-family:var(--serif);font-size:13px;color:var(--ts);">' + t("standalone_detail") + '</div></div>';
      var body = document.getElementById("stan-outBody");
      if (body) body.innerHTML = msg + (body.innerHTML || "");
      return;
    }
    askWhereToInject(pendingOut.key);
  }

  /* ── Injection ── */
  function injectKey(key) {
    var target = window.INJECT_TARGET && window.INJECT_TARGET[key];
    if (!target) {
      addMsg(t("not_injectable_msg"), "ok");
      return;
    }

    var section = findSection(target.selector);
    // Fallback chain
    if (!section && target.fallback_id) section = document.getElementById(target.fallback_id);
    if (!section && target.fallback_anchor) {
      var anchored = getElementsBetweenComments(target.fallback_anchor + "_START", target.fallback_anchor + "_END");
      if (anchored.length) section = anchored[0].parentElement || anchored[0];
    }
    if (!section) {
      addMsg("Section cible introuvable dans le m\u00e9mo.", "ok");
      return;
    }

    var injectHtml = target.html || (window.OUT_CONTENT[key] && window.OUT_CONTENT[key].html) || "";
    if (!injectHtml) return;

    // For sub-cells, replace content
    if (target.is_subcell) {
      section.innerHTML = injectHtml;
      section.classList.add("flash");
      section.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(function() { section.classList.remove("flash"); }, 2400);
      pushHist(target.label + " mis \u00e0 jour dans le m\u00e9mo");
      addMsg('<strong>' + t("injected_confirm") + ' ' + target.label + '.</strong><br><br>' + t("scroll_to_see"), "ok");
      return;
    }

    // Append block
    var existId = "stan-injected-" + key;
    var block = document.getElementById(existId);
    if (!block) {
      block = document.createElement("div");
      block.id = existId;
      block.style.cssText = "margin:12px 0;";

      var ctrlBar = document.createElement("div");
      ctrlBar.style.cssText = "display:flex;gap:6px;align-items:center;padding:3px 0 6px;border-bottom:1px solid var(--border-l);margin-bottom:8px;";
      var ctrlLbl = document.createElement("span");
      ctrlLbl.style.cssText = "font-family:var(--mono);font-size:10px;color:var(--tl);flex:1;letter-spacing:.06em;";
      ctrlLbl.textContent = "Stan \u00b7 " + target.label;
      var ctrlDel = document.createElement("button");
      ctrlDel.style.cssText = "font-family:var(--serif);font-size:12px;color:var(--red);background:none;border:none;cursor:pointer;padding:0;";
      ctrlDel.textContent = t("delete_section");
      var ctrlHide = document.createElement("button");
      ctrlHide.style.cssText = "font-family:var(--serif);font-size:12px;color:var(--tl);background:none;border:none;cursor:pointer;padding:0;margin-left:8px;";
      ctrlHide.textContent = t("hide_section");
      (function(bid, hBtn) {
        ctrlDel.onclick = function() { var b2 = document.getElementById(bid); if (b2) b2.style.display = "none"; };
        ctrlHide.onclick = function() { var b2 = document.getElementById(bid); if (!b2) return; var ic = b2.querySelector(".stan-injected-content"); if (ic) { var hidden = ic.style.display === "none"; ic.style.display = hidden ? "" : "none"; hBtn.textContent = hidden ? t("hide_section") : t("show_section"); } };
      })(existId, ctrlHide);
      ctrlBar.appendChild(ctrlLbl); ctrlBar.appendChild(ctrlDel); ctrlBar.appendChild(ctrlHide);

      var innerWrap = document.createElement("div");
      innerWrap.className = "stan-injected-content";
      innerWrap.innerHTML = injectHtml;

      block.appendChild(ctrlBar);
      block.appendChild(innerWrap);

      // Add output link
      if (pendingOut && window.OUT_CONTENT[pendingOut.key]) {
        var outKey = pendingOut.key;
        var linkBar = document.createElement("div");
        linkBar.style.cssText = "margin-top:8px;padding-top:6px;border-top:1px solid var(--border-l);";
        var linkBtn = document.createElement("button");
        linkBtn.style.cssText = "font-family:var(--serif);font-size:12px;font-weight:600;background:none;border:1px solid var(--border);padding:2px 8px;cursor:pointer;color:var(--ts);";
        linkBtn.textContent = t("view_output_full");
        (function(k) { linkBtn.onclick = function() { openOutModal(k); }; })(outKey);
        linkBar.appendChild(linkBtn);
        block.appendChild(linkBar);
      }
      section.appendChild(block);
    }

    section.classList.add("flash");
    section.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(function() { section.classList.remove("flash"); }, 2400);

    if (pendingOut) {
      var idx = savedOutputs.findIndex(function(o) { return o.key === pendingOut.key; });
      if (idx >= 0) savedOutputs[idx].status = "inject\u00e9";
      renderOutputs();
    }
    pushHist((target.label || key) + " inject\u00e9 dans le m\u00e9mo");
    addMsg('<strong>' + t("injected_confirm") + ' ' + target.label + '.</strong><br><br>' + t("scroll_to_see"), "ok");
  }

  /* ── Injection Chooser ── */
  function askWhereToInject(key, htmlContent) {
    pendingInjectKey = key;
    pendingInjectHtml = htmlContent || (window.INJECT_TARGET && window.INJECT_TARGET[key] ? window.INJECT_TARGET[key].html : null);
    selectedInjectTarget = null;

    var sections = window.INJECT_SECTIONS || [];
    var body = '<div style="font-family:var(--serif);font-style:italic;font-size:13px;color:var(--tl);margin-bottom:12px;">' + t("inject_target_label") + '</div>';

    sections.forEach(function(sec) {
      var indent = sec.subcell ? "margin-left:16px;" : "";
      body += '<div class="stan-inj-option" id="stan-inj-opt-' + sec.id + '" data-inject-target="' + sec.id + '" style="' + indent + '">' +
        '<span class="stan-inj-opt-icon">' + sec.icon + '</span>' +
        '<div><div class="stan-inj-opt-name">' + sec.label + '</div><div class="stan-inj-opt-desc">' + sec.desc + '</div></div>' +
      '</div>';
    });

    var sub = document.getElementById("stan-injectModalSub");
    if (sub) sub.textContent = key && window.INJECT_TARGET && window.INJECT_TARGET[key] ? "Pour : " + window.INJECT_TARGET[key].label : t("inject_target_label");

    var modalBody = document.getElementById("stan-injectModalBody");
    if (modalBody) modalBody.innerHTML = body;

    var btn = document.getElementById("stan-injectConfirmBtn");
    if (btn) { btn.disabled = true; btn.style.opacity = "0.4"; }

    closeModal("stan-outModal");
    openModal("stan-injectModal");

    // Pre-select default
    if (key && window.INJECT_TARGET && window.INJECT_TARGET[key]) {
      setTimeout(function() { selectInjectTarget(window.INJECT_TARGET[key].selector); }, 50);
    }
  }

  function selectInjectTarget(sectionId) {
    selectedInjectTarget = sectionId;
    document.querySelectorAll(".stan-inj-option").forEach(function(el) { el.classList.remove("selected"); });
    var opt = document.getElementById("stan-inj-opt-" + sectionId);
    if (opt) opt.classList.add("selected");
    var btn = document.getElementById("stan-injectConfirmBtn");
    if (btn) { btn.disabled = false; btn.style.opacity = "1"; }
  }

  function confirmInject() {
    if (!selectedInjectTarget) return;
    closeModal("stan-injectModal");

    if (selectedInjectTarget === "new-section") {
      var memoScroll = document.getElementById("memo-content") || document.querySelector(".stan-memo-scroll");
      var newSec = document.createElement("div");
      newSec.className = "section-container";
      newSec.id = "stan-custom-" + Date.now();
      newSec.innerHTML = '<h2>' + t("section_custom") + '</h2>' + (pendingInjectHtml || "");
      if (memoScroll) memoScroll.appendChild(newSec);
      newSec.scrollIntoView({ behavior: "smooth", block: "center" });
      addMsg('<strong>' + t("new_section") + '</strong>', "ok");
    } else {
      if (pendingInjectKey && window.INJECT_TARGET && window.INJECT_TARGET[pendingInjectKey]) {
        var original = window.INJECT_TARGET[pendingInjectKey];
        var override = {};
        for (var k in original) override[k] = original[k];
        override.selector = selectedInjectTarget;
        window.INJECT_TARGET["__override__"] = override;
        injectKey("__override__");
        delete window.INJECT_TARGET["__override__"];
      } else if (pendingInjectHtml) {
        var section = findSection(selectedInjectTarget);
        if (section) {
          var block = document.createElement("div");
          block.id = "stan-injected-paste-" + Date.now();
          block.innerHTML = pendingInjectHtml;
          section.appendChild(block);
          section.classList.add("flash");
          section.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(function() { section.classList.remove("flash"); }, 2400);
          pushHist("R\u00e9sultat coll\u00e9 inject\u00e9");
          addMsg('<strong>' + t("injected_confirm") + '</strong><br><br>' + t("scroll_to_see"), "ok");
        }
      }
    }
    pendingInjectKey = null;
    pendingInjectHtml = null;
  }

  /* ── Paste modal ── */
  function openPasteModal(dirId, dirName) {
    pasteDirectiveId = dirId;
    pasteDirectiveName = dirName;
    var area = document.getElementById("stan-pasteResultArea");
    if (area) area.value = "";
    openModal("stan-pasteModal");
  }

  function acceptPastedResult() {
    var area = document.getElementById("stan-pasteResultArea");
    var text = area ? area.value.trim() : "";
    if (!text) return;
    closeModal("stan-pasteModal");

    var key = "paste-" + Date.now();
    var title = (pasteDirectiveName || "R\u00e9sultat coll\u00e9") + " \u2014 " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    var html = '<div style="font-family:var(--serif);font-size:14px;color:var(--tb);line-height:1.75;white-space:pre-wrap;">' + text.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</div>';

    window.OUT_CONTENT[key] = { title: title, html: html };
    pendingOut = { key: key, data: window.OUT_CONTENT[key] };
    saveOutput(key, window.OUT_CONTENT[key]);

    switchTab("chat");
    var el = addMsg('<strong>' + t("paste_saved") + '</strong><br><br>' + t("paste_inject_ask"), "ok");
    addFups(el, [
      { label: t("choose_inject"), fn: function() { askWhereToInject(null, html); } },
      { label: t("see_outputs"), tab: "outputs" }
    ]);
  }

  /* ── Directives ── */
  function launchDirective(dirId) {
    var dir = window.DIRECTIVES && window.DIRECTIVES[dirId];
    if (!dir) return;
    var isCopy = (dir.engine === "copy_claude");
    var params = dir.params(DEAL_CONTEXT);
    var prompt = dir.prompt_template(params);

    // Strip technical JSON lines from displayed prompt
    var displayLines = [];
    prompt.split("\n").forEach(function(ln) {
      var isTech = (ln.indexOf("Retourne") !== -1 && ln.indexOf("JSON") !== -1) ||
                   (ln.indexOf("Format") !== -1 && ln.indexOf("JSON") !== -1);
      if (!isTech) displayLines.push(ln);
    });
    var displayPrompt = displayLines.join("\n").trim();

    // Build params HTML
    function buildParams() {
      var h = '<div style="background:var(--off);border:1px solid var(--border);padding:12px 14px;margin-bottom:14px;">';
      h += '<div style="font-family:var(--mono);font-size:10px;color:var(--tl);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">' + t("dir_params") + '</div>';
      Object.keys(params).forEach(function(k) {
        if (typeof params[k] === "object") return;
        h += '<div style="display:grid;grid-template-columns:100px 1fr;gap:6px;align-items:center;padding:5px 0;border-bottom:1px solid var(--border-l);">';
        h += '<span style="font-family:var(--mono);font-size:10px;color:var(--tl);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + k + '</span>';
        h += '<input id="stan-dp-' + dirId + '-' + k + '" value="' + String(params[k]).replace(/"/g, '&quot;') + '" style="width:100%;min-width:0;font-family:var(--serif);font-size:13px;padding:3px 6px;border:1px solid var(--border);color:var(--navy);box-sizing:border-box;">';
        h += '</div>';
      });
      h += '</div>';
      return h;
    }

    var outTi = document.getElementById("stan-outTi");
    if (outTi) outTi.textContent = dir.name;
    var html = "";

    if (isCopy) {
      html += '<div style="display:flex;flex-direction:column;gap:12px;">';
      html += buildParams();
      // Step 1
      html += '<div style="border:2px solid var(--abr);background:#fffbf0;padding:14px 16px;">' +
        '<div style="font-family:var(--mono);font-size:10px;color:var(--amber);font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">\u2460 ' + t("dir_step1") + '</div>' +
        '<div style="font-family:var(--serif);font-size:14px;color:var(--tb);line-height:1.6;margin-bottom:12px;">' + t("dir_step1_desc") + '</div>' +
        '<button id="stan-dir-copy-btn-' + dirId + '" style="font-family:var(--serif);font-size:15px;font-weight:700;background:var(--navy);color:#fff;border:none;padding:11px 24px;cursor:pointer;width:100%;">\ud83d\udccb ' + t("dir_copy_prompt") + '</button></div>';
      // Step 2
      html += '<div style="border:2px solid var(--bbr);background:var(--bbg);padding:14px 16px;">' +
        '<div style="font-family:var(--mono);font-size:10px;color:var(--blue);font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">\u2461 ' + t("dir_step2") + '</div>' +
        '<div style="font-family:var(--serif);font-size:14px;color:var(--tb);line-height:1.6;margin-bottom:10px;">' + t("dir_step2_desc") + '</div>' +
        '<button onclick="window.open(\'https://claude.ai/new\',\'_blank\')" style="font-family:var(--serif);font-size:14px;font-weight:600;background:var(--blue);color:#fff;border:none;padding:9px 20px;cursor:pointer;margin-right:8px;">' + t("dir_open_claude") + '</button>' +
        '<button onclick="window.open(\'https://gemini.google.com\',\'_blank\')" style="font-family:var(--serif);font-size:14px;font-weight:600;background:transparent;color:var(--blue);border:1px solid var(--bbr);padding:9px 20px;cursor:pointer;">' + t("dir_open_gemini") + '</button></div>';
      // Step 3
      html += '<div style="border:2px solid var(--gbr);background:var(--gbg);padding:14px 16px;">' +
        '<div style="font-family:var(--mono);font-size:10px;color:var(--green);font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">\u2462 ' + t("dir_step3") + '</div>' +
        '<div style="font-family:var(--serif);font-size:14px;color:var(--tb);line-height:1.6;margin-bottom:10px;">' + t("dir_step3_desc") + '</div>' +
        '<button id="stan-dir-paste-btn-' + dirId + '" style="font-family:var(--serif);font-size:14px;font-weight:600;background:var(--green);color:#fff;border:none;padding:9px 20px;cursor:pointer;width:100%;">' + t("paste_result") + '</button></div>';
      // Prompt preview
      html += '<details style="border:1px solid var(--border-l);"><summary style="font-family:var(--mono);font-size:10px;color:var(--tl);text-transform:uppercase;letter-spacing:.1em;padding:8px 12px;cursor:pointer;">' + t("dir_view_prompt") + ' \u25be</summary>' +
        '<div style="padding:10px 12px;background:var(--off);font-family:var(--mono);font-size:11px;color:var(--tb);line-height:1.65;white-space:pre-wrap;max-height:180px;overflow-y:auto;">' + displayPrompt.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</div></details>';
      html += '</div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:12px;">';
      html += buildParams();
      html += '<div style="border:2px solid var(--gbr);background:#f0fdf4;padding:14px 16px;">' +
        '<div style="font-family:var(--mono);font-size:10px;color:var(--green);font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">\u26a1 ' + t("dir_modal_mode") + '</div>' +
        '<div style="font-family:var(--serif);font-size:14px;color:var(--tb);line-height:1.6;margin-bottom:14px;">' + dir.description + '</div>' +
        '<button id="stan-dir-launch-btn-' + dirId + '" style="font-family:var(--serif);font-size:16px;font-weight:700;background:var(--green);color:#fff;border:none;padding:14px 32px;cursor:pointer;width:100%;">\u26a1 ' + t("dir_launch") + '</button></div>';
      // Copy alt
      html += '<details style="border:1px solid var(--border-l);"><summary style="font-family:var(--mono);font-size:10px;color:var(--tl);text-transform:uppercase;letter-spacing:.1em;padding:8px 12px;cursor:pointer;">' + t("dir_prefer_copy") + ' \u25be</summary>' +
        '<div style="padding:12px;display:flex;flex-direction:column;gap:8px;">' +
        '<div style="background:var(--off);padding:8px 10px;font-family:var(--mono);font-size:11px;color:var(--tb);line-height:1.6;white-space:pre-wrap;max-height:140px;overflow-y:auto;">' + displayPrompt.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</div>' +
        '<button id="stan-dir-copy-alt-' + dirId + '" style="font-family:var(--serif);font-size:14px;font-weight:600;background:var(--navy);color:#fff;border:none;padding:8px 18px;cursor:pointer;align-self:flex-start;">\ud83d\udccb ' + t("dir_copy_prompt") + '</button>' +
        '</div></details>';
      html += '</div>';
    }

    var outBody = document.getElementById("stan-outBody");
    if (outBody) outBody.innerHTML = html;

    // Footer
    var ft = document.getElementById("stan-outFt");
    if (ft) {
      ft.innerHTML = '<button class="stan-mb stan-out" data-close="stan-outModal">' + t("close") + '</button>';
    }

    // Wire buttons after DOM update
    setTimeout(function() {
      var copyBtn = document.getElementById("stan-dir-copy-btn-" + dirId);
      if (copyBtn) copyBtn.onclick = function() {
        navigator.clipboard.writeText(prompt).catch(function() {
          var ta = document.createElement("textarea"); ta.value = prompt;
          document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
        });
        copyBtn.textContent = t("dir_copied"); copyBtn.style.background = "var(--green)";
        pushHist('Prompt "' + dir.name + '" copi\u00e9');
        setTimeout(function() { copyBtn.textContent = "\ud83d\udccb " + t("dir_copy_prompt"); copyBtn.style.background = "var(--navy)"; }, 3000);
      };

      var copyAlt = document.getElementById("stan-dir-copy-alt-" + dirId);
      if (copyAlt) copyAlt.onclick = function() {
        navigator.clipboard.writeText(prompt).catch(function() {
          var ta = document.createElement("textarea"); ta.value = prompt;
          document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
        });
        copyAlt.textContent = t("dir_copied"); copyAlt.style.background = "var(--green)";
        setTimeout(function() { copyAlt.textContent = "\ud83d\udccb " + t("dir_copy_prompt"); copyAlt.style.background = "var(--navy)"; }, 3000);
      };

      var pasteBtn = document.getElementById("stan-dir-paste-btn-" + dirId);
      if (pasteBtn) pasteBtn.onclick = function() {
        closeModal("stan-outModal");
        openPasteModal(dirId, dir.name);
      };

      var launchBtn = document.getElementById("stan-dir-launch-btn-" + dirId);
      if (launchBtn) launchBtn.onclick = async function() {
        launchBtn.textContent = t("dir_running"); launchBtn.disabled = true; launchBtn.style.opacity = ".6";
        closeModal("stan-outModal");
        switchTab("chat");
        var tw = document.getElementById("stan-typingW"); tw.classList.add("show");
        addUser(dir.name);

        try {
          // Re-read params from editable inputs
          var updatedParams = {};
          Object.keys(params).forEach(function(k) {
            if (typeof params[k] === "object") { updatedParams[k] = params[k]; return; }
            var inp = document.getElementById("stan-dp-" + dirId + "-" + k);
            updatedParams[k] = inp ? inp.value : params[k];
          });
          var updatedPrompt = dir.prompt_template(updatedParams);

          var memoEl = document.querySelector(".stan-main") || document.body;
          var response = await fetch(MODAL_BASE + "stan-skills-fastapi-app.modal.run/directive/" + dirId, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company_name: DEAL_CONTEXT.name || "",
              prompt: updatedPrompt,
              lang: window.STAN_LANG || "fr",
              memo_html: memoEl.innerHTML || ""
            })
          });

          var result = await response.json();
          tw.classList.remove("show");

          if (result.error) {
            addMsg("<strong>Erreur :</strong> " + result.error, "");
            return;
          }

          // Save as output
          if (result.output_html) {
            var outData = { title: result.output_title || dir.name, html: result.output_html };
            var outKey = "dir_" + dirId;
            window.OUT_CONTENT[outKey] = outData;
            saveOutput(outKey, outData);
          }

          var msg = '<strong>' + dir.name + ' \u2014 ' + t("dir_result_received") + '</strong><br><br>';
          if (dir.file_type === "xlsx") msg += t("dir_excel_result");
          else if (dir.file_type === "pptx") msg += t("dir_pptx_result");
          else msg += t("dir_generic_result");
          var el = addMsg(msg, "ok");
          var fups = [{ label: t("see_outputs"), tab: "outputs" }];
          if (dir.inject_target) fups.push({ label: t("choose_inject"), fn: function() { askWhereToInject(dirId); } });
          addFups(el, fups);
          pushHist("Directive " + dir.name + " lanc\u00e9e");
          await persistStanState();
        } catch (err) {
          tw.classList.remove("show");
          addMsg("<strong>Erreur r\u00e9seau.</strong> V\u00e9rifiez la connexion et r\u00e9essayez.", "");
          console.error("Stan directive error:", err);
        }
      };
    }, 50);

    openModal("stan-outModal");
  }

  /* ── Memo section controls ── */
  function initMemoControls() {
    // Add hover controls to section-container elements
    var sections = document.querySelectorAll(".section-container");
    sections.forEach(function(sec) {
      if (!sec.id) return;
      var ctrl = document.createElement("div");
      ctrl.className = "stan-sec-controls";
      ctrl.innerHTML =
        '<button class="stan-sc-btn" data-action="hide" data-section="' + sec.id + '">' + t("hide_section") + '</button>' +
        '<button class="stan-sc-btn" data-action="delete" data-section="' + sec.id + '">' + t("delete_section") + '</button>' +
        '<button class="stan-sc-btn" data-action="edit" data-section="' + sec.id + '">' + t("edit_via_stan") + '</button>';
      sec.style.position = "relative";
      sec.appendChild(ctrl);
    });
  }

  function hideSection(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var isHidden = el.classList.contains("stan-hidden-sec");
    el.classList.toggle("stan-hidden-sec");
    pushHist((isHidden ? t("section_shown") : t("section_hidden")) + " \u2014 " + id);
  }

  function deleteSection(id) {
    if (!confirm(t("delete_confirm"))) return;
    var el = document.getElementById(id);
    if (!el) return;
    el.style.display = "none";
    pushHist(t("section_deleted") + " \u2014 " + id);
  }

  function editSection(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var title = el.querySelector("h2, .sec-ti, [class*='title']");
    var sectionName = title ? title.textContent : id;
    switchTab("chat");
    openSidebar();
    var inp = document.getElementById("stan-chatInput");
    if (inp) { inp.value = t("edit_section_prefix") + sectionName + " : "; inp.focus(); }
  }

  /* ── Text selection → Chat ── (disabled: text selection in memo no longer auto-fills the chat) */
  function initTextSelection() {
    // Intentionally a no-op. Selecting text in the memo should not hijack the
    // chat input or open the sidebar. Users copy/paste manually if they need to.
  }

  /* ── Persistence (Airtable bridge) ── */
  function getCompletedTaskIds() {
    var ids = [];
    PHASES.forEach(function(p) { p.tasks.forEach(function(t) { if (t.done) ids.push(t.id); }); });
    return ids;
  }

  async function loadStanState() {
    if (!DEAL_CONTEXT.airtable_record) return;
    try {
      var res = await fetch(MODAL_BASE + "airtable-bridge-fastapi-app.modal.run/stan-state?record_id=" + DEAL_CONTEXT.airtable_record);
      var data = await res.json();
      // Restore completed tasks
      if (data.tasks_done) {
        data.tasks_done.forEach(function(tid) {
          for (var i = 0; i < PHASES.length; i++) {
            for (var j = 0; j < PHASES[i].tasks.length; j++) {
              if (PHASES[i].tasks[j].id === tid) PHASES[i].tasks[j].done = true;
            }
          }
        });
      }
      // Restore outputs
      if (data.outputs_json) {
        try {
          var outs = JSON.parse(data.outputs_json);
          if (Array.isArray(outs)) savedOutputs = outs;
        } catch(e) {}
      }
      // Restore CEO decision state
      if (data.ceo_decision || data.ceo_note || data.ceo_decision_date) {
        window.DEAL_CONTEXT = Object.assign({}, window.DEAL_CONTEXT || {}, {
          ceo_decision:      data.ceo_decision || null,
          ceo_note:          data.ceo_note || null,
          ceo_decision_date: data.ceo_decision_date || null,
          ceo_ncl:           data.ceo_ncl || null,
        });
      }
      // Refresh UI
      renderTimeline(); updateProgress(); updateNextAction(); renderOutputs();
      stanRenderStatusBlock();
    } catch(e) {
      console.warn("Stan: impossible de charger l\u2019\u00e9tat depuis Airtable", e);
    }
  }

  async function persistStanState() {
    if (!DEAL_CONTEXT.airtable_record) return;
    try {
      await fetch(MODAL_BASE + "airtable-bridge-fastapi-app.modal.run/stan-state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_id: DEAL_CONTEXT.airtable_record,
          tasks_done: getCompletedTaskIds(),
          outputs_json: JSON.stringify(savedOutputs)
        })
      });
    } catch(e) {
      console.warn("Stan: impossible de sauvegarder l\u2019\u00e9tat", e);
    }
  }

  /* ── GitHub commits ── */
  async function pushCommitToGitHub(message) {
    if (!DEAL_CONTEXT.github_repo || !DEAL_CONTEXT.github_file) return;
    try {
      var memoEl = document.getElementById("memo-content") || document.querySelector(".stan-memo-scroll");
      await fetch(MODAL_BASE + "github-bridge-fastapi-app.modal.run/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: DEAL_CONTEXT.github_repo,
          file: DEAL_CONTEXT.github_file,
          message: "[Stan] " + message,
          content: memoEl ? memoEl.innerHTML : ""
        })
      });
    } catch(e) {
      console.warn("Stan: commit GitHub \u00e9chou\u00e9", e);
    }
  }

  /* ── Event delegation ── */
  function wireEvents() {
    // FAB
    document.getElementById("stan-fabBtn").onclick = openSidebar;
    // Close
    document.getElementById("stan-close-btn").onclick = closeSidebar;
    // Guide pill
    document.getElementById("stan-guidePillBtn").onclick = toggleGuide;
    // Next action
    document.getElementById("stan-nextAct").onclick = toggleNextAction;

    // Tabs
    ["roadmap", "chat", "skills", "outputs", "hist"].forEach(function(name) {
      var btn = document.getElementById("stan-tab-" + name);
      if (btn) btn.onclick = function() { switchTab(name, btn); };
    });

    // Chat input
    var chatInput = document.getElementById("stan-chatInput");
    if (chatInput) chatInput.onkeydown = handleKey;
    // Send
    var sendBtn = document.getElementById("stan-sendBtn");
    if (sendBtn) sendBtn.onclick = sendMsg;
    // Attach buttons
    var pdfBtn = document.getElementById("stan-btn-pdf");
    if (pdfBtn) pdfBtn.onclick = function() { simAttach("pdf"); };
    var linkBtn = document.getElementById("stan-btn-link");
    if (linkBtn) linkBtn.onclick = function() { simAttach("link"); };

    // Paste accept
    var pasteAcceptBtn = document.getElementById("stan-pasteAcceptBtn");
    if (pasteAcceptBtn) pasteAcceptBtn.onclick = acceptPastedResult;

    // Inject confirm
    var injectConfirmBtn = document.getElementById("stan-injectConfirmBtn");
    if (injectConfirmBtn) injectConfirmBtn.onclick = confirmInject;

    // Output modal buttons
    var shareBtn = document.getElementById("stan-shareBtn");
    if (shareBtn) shareBtn.onclick = shareOutput;
    var injBtn = document.getElementById("stan-injectBtn");
    if (injBtn) injBtn.onclick = injectOutput;

    // Delegated events on body
    document.body.addEventListener("click", function(e) {
      var target = e.target;

      // Modal close buttons
      var closeId = target.getAttribute("data-close");
      if (closeId) { closeModal(closeId); return; }

      // Skill cards
      var skillCard = target.closest("[data-skill]");
      if (skillCard) { sc(skillCard.getAttribute("data-skill")); return; }

      // Directive cards
      var dirCard = target.closest("[data-directive]");
      if (dirCard) { launchDirective(dirCard.getAttribute("data-directive")); return; }

      // Output view
      var outView = target.getAttribute("data-out-view");
      if (outView) { openOutModal(outView); return; }

      // Output share (qs)
      var qsIdx = target.getAttribute("data-qs");
      if (qsIdx !== null && qsIdx !== undefined) {
        var i = parseInt(qsIdx, 10);
        pendingOut = { key: savedOutputs[i].key, data: window.OUT_CONTENT[savedOutputs[i].key] };
        openOutModal(savedOutputs[i].key);
        setTimeout(shareOutput, 50);
        return;
      }

      // Output inject (qi)
      var qiIdx = target.getAttribute("data-qi");
      if (qiIdx !== null && qiIdx !== undefined) {
        var j = parseInt(qiIdx, 10);
        pendingOut = { key: savedOutputs[j].key, data: window.OUT_CONTENT[savedOutputs[j].key] };
        askWhereToInject(savedOutputs[j].key);
        return;
      }

      // Inject target selection
      var injectTarget = target.closest("[data-inject-target]");
      if (injectTarget) { selectInjectTarget(injectTarget.getAttribute("data-inject-target")); return; }

      // Remove attachment
      var rmAttach = target.getAttribute("data-rm-attach");
      if (rmAttach !== null) { attached.splice(parseInt(rmAttach, 10), 1); renderAttach(); return; }

      // Section controls
      var scBtn = target.closest("[data-action]");
      if (scBtn) {
        var action = scBtn.getAttribute("data-action");
        var secId = scBtn.getAttribute("data-section");
        if (action === "hide") hideSection(secId);
        else if (action === "delete") deleteSection(secId);
        else if (action === "edit") editSection(secId);
        return;
      }

      // Guide nav buttons
      var guideNav = target.closest(".stan-guide-nav");
      if (guideNav) {
        toggleGuide();
        switchTab(guideNav.getAttribute("data-tab"));
        return;
      }

      // Guide close button
      if (target.classList.contains("stan-guide-close-btn")) {
        toggleGuide();
        return;
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════ */
  function init() {
    var layout = wrapLayout();
    var sidebar = buildSidebar(layout);

    loadAssets(function() {
      // Wire the essential events FIRST so FAB/close always work
      // even if a later step throws.
      try { wireEvents(); } catch (e) { console.error("Stan wireEvents failed:", e); }

      try {
        PHASES = (window.PHASES_BY_STATUS && window.PHASES_BY_STATUS[DEAL_STATUS]) ||
                 (window.PHASES_BY_STATUS && window.PHASES_BY_STATUS["CALL"]) || [];

        buildSkillsTab();
        buildWelcomeMessage();
        buildGuide();
        mapMemoSections();
        initMemoControls();
        initTextSelection();

        renderTimeline();
        updateProgress();
        updateNextAction();
        renderStatusButtons();
        stanRenderStatusBlock();
        stanUpdateTopPill();

        loadStanState();
      } catch (e) {
        console.error("Stan init failed:", e);
      }

    });
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
