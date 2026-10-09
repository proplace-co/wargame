/* Stan Parcours — canonical production entry point, also used by the isolated demo. */
(function () {
  'use strict';
  if (window.StanJourney) return;
  var meta = document.querySelector('meta[name="stan-deal"]');
  if (!meta) return;
  var context;
  try { context = JSON.parse(meta.content); } catch (_) { return; }
  var script = document.currentScript;
  var assetBase = script && script.src ? new URL('.', script.src).href : 'https://analysis.proplace.co/';
  var API = 'https://alexandre-79537--stan-journey-web.modal.run';
  var record = context.airtable_record || context.deal_id;
  var demo = !!window.__STAN_JOURNEY_DEMO__;
  var state = null, pane = 'roadmap', active = '', filter = '', search = '', poll = null, running = false, pendingResult = '';
  var selected = new Set(), key = '', accessToken = '', memberSession = '', accessPending = null, shell, content, statusLine, fab, opened = false, pendingDossier = null, reconnectNeeded = false, reconnectNotice;
  var loginFrame = null, loginChannel = '', loginDialog = null, loginOpener = null, loginTimer = null;
  var openingDossier = null, connectionProgress;
  var states = { ready: 'À faire', running: 'En cours', awaiting_evidence: 'Pièces attendues', review: 'À valider',
    validated: 'Validé', failed: 'À reprendre', not_applicable: 'Non applicable' };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var date = function (n) { return new Date(n * 1000).toLocaleString(context.lang === 'en' ? 'en-GB' : 'fr-FR'); };
  var euro = function (n) { return Number(n || 0).toFixed(2).replace('.', ',') + ' €'; };
  var actionLabels = { memo: 'Réutiliser le mémo et le dossier', fit: 'Vérifier les critères de la thèse', market: 'Compléter le marché et les concurrents', identity: 'Trouver les dirigeants et les contacts', outreach: 'Préparer le message et le rendez-vous', access: 'Générer le NDA et la demande de pièces', call: 'Préparer les questions et le compte rendu', founder_refs: 'Préparer les références fondateur', finance: 'Rapprocher les comptes et les encaissements', model: 'Calculer les scénarios financiers', loi: 'Préparer les conditions et la LOI', coinvestors: 'Préparer le financement et les messages', legal: 'Analyser les pièces juridiques', ownership: 'Contrôler la cap table', tech: 'Préparer l’audit technique', customer_refs: 'Préparer les références clients', risks: 'Actualiser le registre de risques', dd_report: 'Produire le rapport de DD', committee: 'Produire le dossier comité', ic: 'Préparer la fiche de décision', agreements: 'Comparer les accords définitifs', closing: 'Préparer la checklist de closing', '100days': 'Produire le plan 100 jours', reporting: 'Préparer le reporting et le board', fairvalue: 'Préparer la valorisation', boltons: 'Rechercher les opportunités complémentaires' };
  function el(tag, attrs, text) { var e = document.createElement(tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (text != null) e.textContent = text; return e; }
  function button(label, cls, action, id) { return '<button type="button" class="ppj-btn ' + (cls || '') + '" data-do="' + action + '"' + (id ? ' data-id="' + esc(id) + '"' : '') + '>' + label + '</button>'; }
  function announce(text, error) { statusLine.textContent = text; statusLine.classList.toggle('ppj-error', !!error); }
  // 09/10 — le Parcours se joue comme une quête : un objectif (le closing), des jalons
  // à franchir et des étapes à cocher une à une, avec leurs preuves. La gestion après
  // closing (plan 100 jours, reporting) est une seconde séquence, hors objectif.
  var AFTER_CLOSING = ['portfolio'], DONE = ['validated', 'not_applicable'];
  var PROGRESS = ['validation', 'not_applicable', 'evidence', 'inputs', 'prepared', 'started'];
  var icon = function (body) { return '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>'; };
  var dot = function (x, r) { return '<circle cx="' + x + '" cy="8" r="' + r + '" fill="currentColor" stroke="none"/>'; };
  // Done, not applicable, draft to validate, evidence awaited, to redo, to refresh; running spins.
  var stepIcons = { done: icon('<path d="M3.5 8.5l3 3 6-7"/>'), skipped: icon('<path d="M4 8h8"/>'), review: icon(dot(8, 2.7)),
    waiting: icon(dot(3.8, 1.3) + dot(8, 1.3) + dot(12.2, 1.3)), failed: icon('<path d="M8 3.6v5.2"/>' + '<circle cx="8" cy="12.2" r="1.2" fill="currentColor" stroke="none"/>'),
    stale: icon('<path d="M12.6 9.4A4.8 4.8 0 1 1 11.2 4.6"/><path d="M12.4 2.6v3.2H9.2"/>'), running: '', todo: '' };
  var knownDone = null, afterOpen = null, toast = null, toastTimer = null;
  function isDone(id) { var item = state.actions[id]; return !!item && DONE.indexOf(item.status) >= 0 && !item.stale; }
  function stepState(id) {
    var item = state.actions[id];
    if (item.stale) return 'stale';
    return ({ validated: 'done', not_applicable: 'skipped', review: 'review', running: 'running', awaiting_evidence: 'waiting', failed: 'failed' })[item.status] || 'todo';
  }
  function afterIds() { return state.catalog.actions.filter(function (a) { return AFTER_CLOSING.indexOf(a.phase) >= 0; }).map(function (a) { return a.id; }); }
  function closingPlan() {
    var catalog = state.catalog;
    var milestones = Object.keys(catalog.phases).map(function (p) {
      var steps = catalog.actions.filter(function (a) { return a.phase === p; });
      var counted = steps.filter(function (a) { return !a.optional; });
      return { id: p, label: catalog.phases[p], after: AFTER_CLOSING.indexOf(p) >= 0, steps: steps,
        total: counted.length, done: counted.filter(function (a) { return isDone(a.id); }).length };
    });
    var closing = milestones.filter(function (m) { return !m.after; }), after = milestones.filter(function (m) { return m.after; });
    var total = 0, done = 0, unfinished = function (m) { return m.done < m.total; };
    closing.forEach(function (m) { total += m.total; done += m.done; });
    // The suggested step follows the visible trail: phase order, prerequisites met first.
    var candidates = [];
    (closing.some(unfinished) ? closing : after).forEach(function (m) {
      m.steps.forEach(function (a) { if (!a.optional && !isDone(a.id)) candidates.push(a); });
    });
    var next = candidates.find(function (a) { var item = state.actions[a.id]; return item.status !== 'running' && !(item.dependencies || []).length; }) || candidates[0] || null;
    return { closing: closing, after: after, total: total, done: done, left: total - done,
      pct: total ? Math.round(done * 100 / total) : 0, current: closing.find(unfinished) || after.find(unfinished) || null, next: next };
  }
  function ring(pct) {
    var c = 2 * Math.PI * 30;
    return '<svg class="ppj-ring" viewBox="0 0 72 72" role="img" aria-label="' + pct + ' % du chemin vers le closing"><defs><linearGradient id="ppj-ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ADE80"/><stop offset="1" stop-color="#12A150"/></linearGradient></defs>' +
      '<circle class="ppj-ring-track" cx="36" cy="36" r="30"/><circle class="ppj-ring-fill" cx="36" cy="36" r="30" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - pct / 100)).toFixed(1) + '" transform="rotate(-90 36 36)"/>' +
      '<text x="36" y="41" text-anchor="middle">' + pct + '%</text></svg>';
  }
  function momentum() {
    var days = {}, latest = 0;
    (state.events || []).forEach(function (e) {
      if (PROGRESS.indexOf(e.kind) < 0 || !e.at) return;
      var day = new Date(e.at * 1000); day.setHours(0, 0, 0, 0);
      days[day.getTime()] = true; latest = Math.max(latest, day.getTime());
    });
    if (!latest) return '';
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var ago = Math.round((today.getTime() - latest) / 86400000), streak = 0;
    if (ago <= 1) for (var d = new Date(latest); days[d.getTime()]; d.setDate(d.getDate() - 1)) streak++;
    return (streak >= 2 ? '<span class="ppj-streak">🔥 ' + streak + ' jours d’affilée</span>' : '') +
      '<span>Dernière avancée ' + (ago <= 0 ? 'aujourd’hui' : ago === 1 ? 'hier' : 'il y a ' + ago + ' jours') + '</span>';
  }
  function closingTarget() {
    var value = ((state.context.action_inputs || {}).loi || {}).closing_target, at = value ? Date.parse(value) : NaN;
    if (!at) return '';
    var days = Math.ceil((at - Date.now()) / 86400000);
    return '<span class="ppj-target">🎯 Closing visé le ' + esc(new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })) + (days >= 0 ? ' · J-' + days : ' · date passée') + '</span>';
  }
  function cheerLine(plan) {
    if (!plan.total) return 'Votre route vers le closing.';
    if (plan.left === 0) return 'Closing atteint : toutes les étapes sont cochées !';
    if (plan.done === 0) return 'C’est parti : cochez votre première étape.';
    if (plan.pct < 25) return 'Le dossier prend forme. Gardez le rythme.';
    if (plan.pct < 50) return 'Belle avancée : le closing se rapproche.';
    if (plan.pct < 75) return 'Plus de la moitié du chemin. Ne lâchez rien !';
    return 'Dernière ligne droite avant le closing !';
  }
  function quickWins(plan) {
    var wins = [], why = { review: 'Brouillon prêt : relisez-le, puis cochez l’étape', stale: 'Nouvelles pièces : actualisez avant de cocher', failed: 'À reprendre : relancez la préparation' };
    ['review', 'stale', 'failed'].forEach(function (wanted) {
      plan.closing.concat(plan.after).forEach(function (m) {
        m.steps.forEach(function (a) {
          if (wins.length < 3 && stepState(a.id) === wanted && !(plan.next && plan.next.id === a.id)) wins.push({ a: a, state: wanted, why: why[wanted] });
        });
      });
    });
    return wins;
  }
  function celebrate() {
    var catalog = state.catalog, done = catalog.actions.filter(function (a) { return isDone(a.id); }).map(function (a) { return a.id; });
    var fresh = knownDone ? done.filter(function (id) { return knownDone.indexOf(id) < 0; }) : [];
    knownDone = done;
    if (!fresh.length) return fresh;
    var plan = closingPlan(), title = (catalog.actions.find(function (a) { return a.id === fresh[fresh.length - 1]; }) || {}).title || '';
    var closingFresh = fresh.filter(function (id) { return afterIds().indexOf(id) < 0; });
    var milestone = plan.closing.find(function (m) { return m.total && m.done === m.total && m.steps.some(function (a) { return closingFresh.indexOf(a.id) >= 0; }); });
    cheer(!closingFresh.length ? '✓ Étape cochée : ' + title + ' · gestion après closing.'
      : plan.left === 0 ? '🏆 Closing : toutes les étapes sont cochées. Bravo !'
        : milestone ? '🎖 Jalon franchi : ' + milestone.label + ' · plus que ' + plan.left + ' étape' + (plan.left > 1 ? 's' : '') + ' avant le closing.'
          : '✓ Étape cochée : ' + title + ' · plus que ' + plan.left + ' avant le closing.');
    return fresh;
  }
  function cheer(text) {
    if (!toast) return;
    toast.textContent = text; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.hidden = true; }, 4500);
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var layer = el('div', { class: 'ppj-confetti', 'aria-hidden': 'true' }), colors = ['#16965e', '#4ADE80', '#E8B93C', '#31599f', '#F08A5D'];
    for (var i = 0; i < 18; i++) {
      var piece = el('i'), angle = i / 18 * 2 * Math.PI, reach = 80 + (i % 3) * 45;
      piece.style.setProperty('--dx', Math.round(Math.cos(angle) * reach) + 'px');
      piece.style.setProperty('--dy', Math.round(Math.sin(angle) * reach + 70) + 'px');
      piece.style.setProperty('--r', (i * 53) + 'deg');
      piece.style.background = colors[i % colors.length]; piece.style.animationDelay = (i % 4) * 40 + 'ms';
      layer.appendChild(piece);
    }
    shell.appendChild(layer); setTimeout(function () { layer.remove(); }, 1800);
  }
  function readAccountData() {
    try {
      var cookie = document.cookie.split('; ').find(function (c) { return c.indexOf('proplace_auth=') === 0; });
      if (!cookie) return {};
      var auth = JSON.parse(atob(decodeURIComponent(cookie.slice('proplace_auth='.length))));
      return auth && typeof auth === 'object' ? auth : {};
    } catch (_) { return {}; }
  }
  function readMemberSession() { var auth = readAccountData(); return typeof auth.member_session === 'string' ? auth.member_session : ''; }
  function accountUrl() {
    var fund = (state && state.context && state.context.fund) || context.fund || context.fund_type || context.fund_slug || readAccountData().fund_type || '';
    if (typeof fund !== 'string') fund = '';
    if (!fund) {
      var link = document.querySelector('a.sidebar-fund-link');
      var found = link && new URL(link.href, location.href).pathname.match(/^\/cibles\/([^/]+)/);
      // Public share tokens are not fund names and cannot bind an OTP login.
      if (found && !/^[a-zA-Z0-9]{16}$/.test(found[1])) fund = decodeURIComponent(found[1]);
    }
    return 'https://proplace.co/fr/compte?journey=1' + (fund ? '&fund=' + encodeURIComponent(fund) : '');
  }
  function requireConnection() {
    reconnectNeeded = true; clearTimeout(poll);
    if (!reconnectNotice || !state) return;
    // Outside the content: retained results and unsaved forms remain intact.
    reconnectNotice.hidden = false;
  }
  function closeAccountPopup() {
    clearTimeout(loginTimer); loginTimer = null;
    if (loginDialog) loginDialog.remove();
    loginDialog = null; loginFrame = null; loginChannel = '';
    if (loginOpener && loginOpener.isConnected) loginOpener.focus();
    loginOpener = null;
  }
  function accountFrameReady() {
    if (!loginDialog) return;
    clearTimeout(loginTimer); loginTimer = null;
    loginDialog.querySelector('.ppj-login-loading').hidden = true;
    loginFrame.removeAttribute('aria-hidden'); loginFrame.removeAttribute('tabindex');
    loginFrame.classList.remove('ppj-login-waiting');
  }
  function openAccountPopup() {
    if (demo || loginDialog) return;
    var bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
    loginChannel = Array.from(bytes).map(function (n) { return n.toString(16).padStart(2, '0'); }).join('');
    var url = new URL(accountUrl());
    url.searchParams.set('popup', '1'); url.searchParams.set('embed', '1'); url.searchParams.set('channel', loginChannel);
    url.searchParams.set('return_origin', location.origin);
    loginOpener = document.activeElement;
    loginDialog = el('div', { class: 'ppj-login-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Connexion à Proplace' });
    var closeButton = el('button', { class: 'ppj-login-close', type: 'button', 'aria-label': 'Fermer la connexion' }, '×');
    closeButton.onclick = closeAccountPopup;
    var card = el('div', { class: 'ppj-login-card' });
    var loading = el('div', { class: 'ppj-login-loading' });
    loading.innerHTML = '<div role="status" aria-live="polite"><strong>Ouverture de la connexion…</strong>' +
      '<p>Votre mémo reste ouvert pendant le chargement.</p></div>' +
      '<div class="ppj-loading-bar" role="progressbar" aria-label="Chargement de la connexion"></div>';
    var retry = el('button', { class: 'ppj-btn', type: 'button' }, 'Réessayer'); retry.hidden = true;
    retry.onclick = function () { closeAccountPopup(); openAccountPopup(); };
    loading.appendChild(retry);
    loginFrame = el('iframe', { title: 'Compte Proplace — email et choix du fonds', src: url.href,
      class: 'ppj-login-waiting', 'aria-hidden': 'true', tabindex: '-1',
      sandbox: 'allow-scripts allow-forms allow-same-origin', referrerpolicy: 'strict-origin-when-cross-origin' });
    // The app handshake can arrive before the full page load (fonts/images).
    // onload also supports account pages still served from an older cache.
    var createdFrame = loginFrame;
    loginFrame.onload = function () { if (loginFrame === createdFrame) accountFrameReady(); };
    card.append(loginFrame, loading); loginDialog.append(closeButton, card); document.body.appendChild(loginDialog);
    loginTimer = setTimeout(function () {
      if (!loginDialog || loading.hidden) return;
      loading.querySelector('p').textContent = 'Le chargement prend plus de temps que prévu. Vous pouvez réessayer ou fermer cette fenêtre.';
      retry.hidden = false;
    }, 12000);
    loginDialog.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeAccountPopup(); }
    });
    closeButton.focus();
  }
  function connectionRestored() {
    reconnectNeeded = false;
    if (reconnectNotice) reconnectNotice.hidden = true;
  }
  function headers() {
    var h = { 'Content-Type': 'application/json' };
    if (accessToken) h['X-Journey-Access'] = accessToken;
    else if (memberSession) h['X-Member-Session'] = memberSession;
    if (key) h['X-Fund-Key'] = key;
    return h;
  }
  async function connectAccount() {
    if (demo || accessToken) return;
    memberSession = memberSession || readMemberSession();
    if (memberSession) key = '';
    if (!memberSession && !key) throw new Error('Connectez votre compte Proplace pour ouvrir ce dossier privé.');
    if (!accessPending) accessPending = (async function () {
      var result = await accountJSON(key ? '/access' : '/connection', {});
      accessToken = result.access_token;
      if (typeof result.fund === 'string') context.fund = result.fund;
      try { sessionStorage.setItem('ppj-access:' + record, accessToken); } catch (_) {}
      connectionRestored();
    }());
    try { await accessPending; } finally { accessPending = null; }
  }
  async function accountJSON(path, data) {
    // Bound the complete account/open response; never abort a paid action or save.
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 45000);
    try { return await (await api(path, data, undefined, controller.signal)).json(); }
    catch (error) {
      if (controller.signal.aborted) throw new Error('L’ouverture du dossier prend trop de temps. Réessayez la connexion.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function api(path, data, method, signal) {
    if (demo) throw new Error('La démonstration ne peut pas appeler un service de production.');
    var res = await fetch(API + '/deals/' + encodeURIComponent(record) + path, { method: method || (data ? 'POST' : 'GET'), headers: headers(), body: data ? JSON.stringify(data) : undefined, credentials: 'omit', signal: signal });
    if (!res.ok) {
      if (res.status === 401) {
        accessToken = ''; try { sessionStorage.removeItem('ppj-access:' + record); } catch (_) {}
        requireConnection();
      }
      var error = await res.json().catch(function () { return {}; });
      var failure = new Error(error.error || error.detail || 'Service indisponible'); failure.status = res.status; throw failure;
    }
    return res;
  }
  async function refresh(initial) {
    if (demo) { state = window.__STAN_JOURNEY_DEMO__.state; render(); return; }
    await connectAccount();
    state = initial ? await accountJSON('/open', {}) : await (await api('')).json();
    render();
    schedule();
  }
  async function openDossier() {
    if (demo) return refresh(true);
    if (openingDossier) return openingDossier;
    connectionProgress.hidden = false;
    shell.querySelectorAll('[data-do=connect]').forEach(function (b) { b.disabled = true; });
    announce('Connexion à votre compte et ouverture du dossier…');
    var slow = setTimeout(function () { announce('L’ouverture prend plus de temps que prévu. La connexion est toujours en cours…'); }, 12000);
    openingDossier = refresh(true);
    try { await openingDossier; announce('Dossier privé ouvert depuis votre compte.'); }
    finally {
      clearTimeout(slow); openingDossier = null; connectionProgress.hidden = true;
      shell.querySelectorAll('[data-do=connect]').forEach(function (b) { b.disabled = false; });
    }
  }
  function schedule() {
    clearTimeout(poll);
    if (!reconnectNeeded && opened && state && Object.values(state.actions).some(function (a) { return a.status === 'running'; })) {
      poll = setTimeout(function () { refresh(false).catch(function (e) { announce(e.message, true); schedule(); }); }, 3500);
    }
  }
  function open(tab) {
    opened = true; shell.hidden = false; fab.hidden = true; pane = tab === 'history' ? 'history' : 'roadmap';
    shell.querySelector('#stan-tab-' + (pane === 'history' ? 'hist' : 'roadmap')).focus();
    render(); schedule();
  }
  function close() { opened = false; shell.hidden = true; fab.hidden = false; clearTimeout(poll); fab.focus(); }
  function build() {
    // A cached legacy editor may initialize just before this production widget.
    // The supported dossier workflow now owns edits; remove its obsolete UI.
    ['plEditor', 'plModal'].forEach(function (id) { var old = document.getElementById(id); if (old) old.remove(); });
    var css = el('link', { rel: 'stylesheet', href: assetBase + 'stan-journey.css?v=7' }); document.head.appendChild(css);
    fab = el('button', { id: 'stan-fabBtn', type: 'button', class: 'ppj-fab' + (demo ? ' ppj-demo-fab' : ''), 'aria-label': 'Stan Beta — ouvrir Parcours' }, 'Stan β · Parcours');
    fab.onclick = function () { open('roadmap'); };
    shell = el('aside', { id: 'stan-sidebar', class: 'ppj-shell', 'aria-label': 'Parcours du dossier' }); shell.hidden = true;
    shell.innerHTML = '<div class="ppj-resize" role="separator" tabindex="0" aria-label="Largeur du panneau" aria-orientation="vertical"></div>' +
      '<header class="ppj-header"><div><span class="ppj-eyebrow">STAN · POSTE DE TRAVAIL</span><h2>' + esc(context.name || context.company_name || 'Votre dossier') + '</h2></div>' +
      '<div>' + button('⤢', '', 'full') + button('×', '', 'close') + '</div></header>' +
      (demo ? '<div class="ppj-demo">Démonstration · dossier fictif · aucun envoi ni crédit consommé</div>' : '') +
      '<nav class="ppj-tabs" aria-label="Vues du dossier"><button id="stan-tab-roadmap" type="button" data-do="roadmap">Parcours</button><button id="stan-tab-hist" type="button" data-do="history">Historique</button></nav>' +
      '<p class="ppj-status" role="status" aria-live="polite"></p><div class="ppj-connection-progress ppj-loading-bar" role="progressbar" aria-label="Ouverture du dossier privé" hidden></div><section class="ppj-notice ppj-reconnect" hidden aria-label="Reprendre l’accès au dossier">' +
      '<strong>Votre accès privé doit être renouvelé.</strong><p>Vos résultats et votre saisie restent affichés pendant la connexion.</p>' +
      button('Se reconnecter à Proplace', 'ppj-primary', 'connect') + '</section><main class="ppj-content"></main>';
    content = shell.querySelector('main'); statusLine = shell.querySelector('[role=status]');
    connectionProgress = shell.querySelector('.ppj-connection-progress');
    reconnectNotice = shell.querySelector('.ppj-reconnect');
    // Celebrations live outside the redrawn content and after the status line.
    toast = el('div', { class: 'ppj-toast', role: 'status', 'aria-live': 'polite' }); toast.hidden = true; shell.appendChild(toast);
    document.body.append(shell, fab);
    shell.addEventListener('click', handleClick);
    shell.addEventListener('submit', handleSubmit);
    shell.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    shell.querySelector('.ppj-resize').addEventListener('pointerdown', function (e) {
      var target = e.currentTarget; target.setPointerCapture(e.pointerId);
      target.onpointermove = function (p) { shell.style.width = Math.min(window.innerWidth, Math.max(390, window.innerWidth - p.clientX)) + 'px'; };
      target.onpointerup = function () { target.onpointermove = null; };
    });
    shell.querySelector('.ppj-resize').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); shell.style.width = Math.min(window.innerWidth, Math.max(390, shell.offsetWidth + (e.key === 'ArrowLeft' ? 40 : -40))) + 'px'; }
    });
    if (!demo) {
      var fromCockpit = false;
      try {
        key = new URLSearchParams(location.search).get('k') || sessionStorage.getItem('ppj-key:' + record) || '';
        var handoff = new URLSearchParams(location.hash.slice(1));
        accessToken = handoff.get('journey') || sessionStorage.getItem('ppj-access:' + record) || '';
        if (handoff.has('journey')) {
          fromCockpit = true;
          sessionStorage.setItem('ppj-access:' + record, accessToken); handoff.delete('journey');
          window.history.replaceState(window.history.state, '', location.pathname + location.search + (handoff.toString() ? '#' + handoff.toString() : ''));
        }
        memberSession = readMemberSession();
      } catch (_) { /* Private browsing */ }
      if (fromCockpit) { open('roadmap'); announce('Ouverture du dossier privé depuis votre cockpit…'); }
    }
    if (demo || key || accessToken || memberSession) openDossier().catch(function (e) { announce(e.message, true); render(); });
    window.dispatchEvent(new Event('stan:ready'));
    if (!demo && window.opener) {
      ['https://proplace.co', 'https://www.proplace.co'].forEach(function (origin) { window.opener.postMessage({ type: 'proplace:journey:ready' }, origin); });
    }
  }
  function render() {
    if (!content) return;
    // A background run must never erase another action's unsaved form.
    if (content.querySelector('form[data-form="add"],form[data-form="attest"],form[data-form="skip"],form[data-form="settings"],form[data-form="inputs"]')) return;
    shell.querySelector('#stan-tab-roadmap').setAttribute('aria-selected', String(pane === 'roadmap'));
    shell.querySelector('#stan-tab-hist').setAttribute('aria-selected', String(pane === 'history'));
    if (!state) {
      content.innerHTML = '<section class="ppj-welcome"><span class="ppj-eyebrow">DE L’ÉVALUATION AU CLOSING</span><h3>Un dossier, toutes les prochaines actions.</h3>' +
        '<p>Retrouvez vos preuves, analyses, décisions et documents dans un espace privé. Toutes les étapes restent consultables.</p>' +
        '<p>Utilisez votre compte Proplace. La même connexion par email permet de choisir votre fonds et d’ouvrir les dossiers qui vous sont rattachés.</p>' +
        button('Se connecter à Proplace', 'ppj-primary', 'connect') +
        '<p class="ppj-muted">Déjà connecté ? Votre session sera reprise automatiquement. Vos documents restent dans cet onglet.</p></section>';
      return;
    }
    var scroll = content.scrollTop, fresh = celebrate();
    content.innerHTML = pane === 'history' ? history() : roadmap();
    content.scrollTop = scroll;
    fresh.forEach(function (id) { var checked = content.querySelector('#stan-action-' + id); if (checked) checked.classList.add('ppj-just-done'); });
    if (pendingResult && pane === 'roadmap' && active === pendingResult && state.actions[pendingResult].status !== 'running' && state.actions[pendingResult].result) {
      var prepared = content.querySelector('#stan-action-' + pendingResult + ' .ppj-result');
      if (prepared) prepared.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      pendingResult = '';
    }
    var searchInput = content.querySelector('[name=search]');
    if (searchInput) searchInput.oninput = function () {
      search = this.value.toLowerCase();
      content.querySelectorAll('.ppj-card').forEach(function (c) { c.hidden = !c.textContent.toLowerCase().includes(search); });
    };
  }
  function roadmap() {
    var plan = closingPlan(), afterSteps = afterIds();
    var showAfter = afterSteps.indexOf(active) >= 0 || AFTER_CLOSING.indexOf(filter) >= 0 || (afterOpen === null ? plan.left === 0 : afterOpen);
    var lastPhase = plan.closing.length ? plan.closing[plan.closing.length - 1].id : '';
    var html = (pendingDossier ? '<div class="ppj-notice">Votre dossier comité modifié est prêt à être réutilisé. ' + button('Importer dans cette étape', '', 'handoff') + '</div>' : '') +
      quest(plan) + stepper(plan) +
      '<div class="ppj-toolbar"><input name="search" type="search" value="' + esc(search) + '" placeholder="Rechercher une étape…" aria-label="Rechercher une étape">' + button('Tout voir', '', 'all') + '</div>' +
      '<p class="ppj-muted">Chaque étape se coche avec ses preuves. Les étapes grisées restent consultables : ouvrez-les pour préparer la suite.</p>';
    if (AFTER_CLOSING.indexOf(filter) < 0) {
      html += '<ol class="ppj-trail">';
      plan.closing.forEach(function (m, i) { if (!filter || filter === m.id) html += milestone(m, i + 1, plan); });
      if (!filter || filter === lastPhase) html += finish(plan);
      html += '</ol>';
    }
    if (plan.after.length && (!filter || AFTER_CLOSING.indexOf(filter) >= 0)) html += afterSequence(plan, showAfter);
    html += '<footer class="ppj-footer">' + button('Exporter le dossier d’audit', '', 'export') + button('Réglages et conservation', '', 'settings') + '</footer>';
    return html;
  }
  function quest(plan) {
    var next = plan.next, wins = quickWins(plan), meta = momentum() + closingTarget();
    var remaining = state.budget.remaining == null ? 5 - state.budget.spent - state.budget.reserved : state.budget.remaining;
    return '<section class="ppj-overview ppj-quest"><div class="ppj-quest-top">' + ring(plan.pct) +
      '<div class="ppj-quest-text"><span class="ppj-quest-kicker">Objectif closing</span><h3>' + esc(cheerLine(plan)) + '</h3>' +
      '<p class="ppj-quest-stats"><b>' + plan.done + ' / ' + plan.total + '</b> étapes cochées' + (plan.left ? ' · plus que <b>' + plan.left + '</b> avant le closing' : '') + '</p>' +
      (meta ? '<p class="ppj-quest-meta">' + meta + '</p>' : '') + '</div></div>' +
      (next ? button('<span>▶ ' + (plan.left ? 'Prochaine étape' : 'Après le closing') + ' : ' + esc(next.title) + '</span><span aria-hidden="true">→</span>', 'ppj-primary ppj-next-cta', 'goto', next.id) : '') +
      (wins.length ? '<div class="ppj-missions"><span class="ppj-missions-t">À cocher maintenant</span>' + wins.map(function (w) {
        return '<button type="button" class="ppj-mission" data-do="goto" data-id="' + w.a.id + '"><span class="ppj-tick" data-state="' + w.state + '" aria-hidden="true">' + stepIcons[w.state] + '</span>' +
          '<span class="ppj-mission-text"><b>' + esc(w.a.title) + '</b><small>' + w.why + '</small></span><span aria-hidden="true">→</span></button>';
      }).join('') + '</div>' : '') +
      '<small class="ppj-quest-budget">Budget Stan : ' + euro(remaining) + ' disponibles sur 5 € · ' + euro(state.budget.reserved) + ' réservés · mémo et experts hors budget</small></section>';
  }
  function stepper(plan) {
    var html = '<nav class="ppj-phase-nav ppj-stepper" aria-label="Jalons jusqu’au closing">';
    plan.closing.forEach(function (m, i) {
      var st = m.total && m.done === m.total ? 'done' : m === plan.current ? 'current' : 'todo';
      if (i) html += '<span class="ppj-link' + (plan.closing[i - 1].done === plan.closing[i - 1].total ? ' ppj-lit' : '') + '" aria-hidden="true"></span>';
      html += '<button type="button" class="ppj-chip ppj-c-' + st + (filter === m.id ? ' ppj-selected' : '') + '" data-do="phase" data-id="' + m.id + '" aria-pressed="' + (filter === m.id) + '"' +
        ' title="' + esc('Jalon ' + (i + 1) + ' · ' + m.label + ' · ' + m.done + '/' + m.total) + '" aria-label="' + esc('Jalon ' + (i + 1) + ' : ' + m.label + ', ' + m.done + ' sur ' + m.total + ' étapes cochées') + '">' + (st === 'done' ? '✓' : i + 1) + '</button>';
    });
    html += '<span class="ppj-link' + (plan.left === 0 ? ' ppj-lit' : '') + '" aria-hidden="true"></span><span class="ppj-chip ppj-c-trophy' + (plan.left === 0 ? ' ppj-c-done' : '') + '" role="img" aria-label="Closing">🏆</span>';
    plan.after.forEach(function (m) {
      html += '<button type="button" class="ppj-chip ppj-c-after' + (filter === m.id ? ' ppj-selected' : '') + '" data-do="phase" data-id="' + m.id + '" aria-pressed="' + (filter === m.id) + '" title="' + esc('Après le closing · ' + m.label) + '" aria-label="' + esc('Après le closing : ' + m.label) + '">100 j</button>';
    });
    var current = plan.current;
    return html + '</nav><p class="ppj-stepper-caption">' + (current && !current.after ? 'Jalon ' + (plan.closing.indexOf(current) + 1) + ' sur ' + plan.closing.length + ' · <b>' + esc(current.label) + '</b>'
      : '<b>Closing atteint</b> · séquence suivante : ' + esc((plan.after[0] || {}).label || 'gestion de la participation')) + '</p>';
  }
  function milestone(m, index, plan) {
    var st = m.total && m.done === m.total ? 'done' : m === plan.current ? 'current' : 'todo';
    var html = '<li class="ppj-milestone ppj-ms-' + st + '" data-phase="' + m.id + '"><span class="ppj-node" aria-hidden="true">' + (st === 'done' ? '✓' : index) + '</span>' +
      '<div class="ppj-ms-head"><div class="ppj-ms-title"><span class="ppj-ms-kicker">' + (m.after ? 'Séquence 2' : 'Jalon ' + index) + (st === 'done' ? ' · franchi' : st === 'current' ? ' · en cours' : '') + '</span><h3>' + esc(m.label) + '</h3></div>' +
      '<span class="ppj-ms-count">' + m.done + '/' + m.total + '</span></div><span class="ppj-ms-bar" aria-hidden="true"><i style="width:' + (m.total ? Math.round(m.done * 100 / m.total) : 0) + '%"></i></span>';
    m.steps.forEach(function (a) { html += card(a, plan); });
    return html + '</li>';
  }
  function finish(plan) {
    var won = plan.total && plan.left === 0;
    return '<li class="ppj-finish' + (won ? ' ppj-won' : '') + '"><span class="ppj-trophy" aria-hidden="true">🏆</span><div><b>' + (won ? 'Closing : toutes les étapes sont cochées' : 'Closing') + '</b>' +
      '<small>' + (won ? 'Bravo ! La gestion de la participation commence.' : 'Plus que ' + plan.left + ' étape' + (plan.left > 1 ? 's' : '') + ' à cocher pour y arriver.') + '</small></div></li>';
  }
  function afterSequence(plan, open) {
    var done = 0, total = 0;
    plan.after.forEach(function (m) { done += m.done; total += m.total; });
    return '<section class="ppj-after' + (open ? ' ppj-after-open' : '') + '"><button type="button" class="ppj-after-head" data-do="after" aria-expanded="' + open + '">' +
      '<span class="ppj-after-icon" aria-hidden="true">🧭</span><span class="ppj-after-text"><span class="ppj-after-kicker">Séquence 2 · après le closing</span><b>Gérer la participation</b>' +
      '<small>' + plan.after.map(function (m) { return esc(m.label); }).join(' · ') + ' · ' + done + '/' + total + ' étapes</small></span><span class="ppj-after-chev" aria-hidden="true">' + (open ? '▴' : '▾') + '</span></button>' +
      '<div class="ppj-after-body"' + (open ? '' : ' hidden') + '><p class="ppj-muted">Une autre séquence : le pilotage après la signature. Elle ne compte pas dans l’objectif closing ; vous pouvez déjà la préparer.</p>' +
      '<ol class="ppj-trail">' + plan.after.map(function (m, i) { return milestone(m, i + 1, plan); }).join('') + '</ol></div></section>';
  }
  function card(a, plan) {
    var item = state.actions[a.id], result = item.result, openNow = active === a.id;
    var ids = item.evidence_ids || [], missing = item.missing || [];
    var s = stepState(a.id), upNext = !!(plan && plan.next && plan.next.id === a.id);
    var html = '<article class="ppj-card ppj-step ppj-s-' + s + (s === 'done' || s === 'skipped' ? ' ppj-done' : '') + (upNext ? ' ppj-is-next' : '') + (openNow ? ' ppj-open' : '') + '" id="stan-action-' + a.id + '"><button class="ppj-card-head" data-do="expand" data-id="' + a.id + '" aria-expanded="' + openNow + '">' +
      '<span class="ppj-tick" data-state="' + s + '" aria-hidden="true">' + stepIcons[s] + '</span>' +
      '<span class="ppj-step-text"><strong>' + esc(a.title) + '</strong><small>' + (upNext ? '<em class="ppj-next-tag">Prochaine étape</em>' : '') + (a.optional ? 'Facultatif · ' : '') + (missing.length ? missing.length + ' élément(s) à compléter' : ids.length + ' pièce(s) disponible(s)') + '</small></span>' +
      '<span class="ppj-badge ppj-' + item.status + '">' + (item.stale ? 'À actualiser' : states[item.status] || esc(item.status)) + '</span></button>';
    if (!openNow) return html + '</article>';
    html += '<div class="ppj-card-body">';
    if (item.legacy_claim) html += '<p class="ppj-notice">' + esc(item.legacy_claim) + '</p>';
    if (item.error) html += '<p class="ppj-error">' + esc(item.error) + '</p>';
    if (item.reason) html += '<p class="ppj-notice">Non applicable : ' + esc(item.reason) + '</p>';
    html += '<h4>Déjà disponible</h4><div class="ppj-docs">' + (ids.length ? ids.map(function (id) { var e = state.evidence[id]; return button('↗ ' + esc(e.title), 'ppj-document', 'evidence', id); }).join('') : '<p class="ppj-muted">Ajoutez les premières pièces du dossier.</p>') + '</div>';
    if (missing.length) html += '<h4>Ce qui manque</h4><ul>' + missing.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
    if (item.dependencies && item.dependencies.length) html += '<p class="ppj-notice">Pour valider : ' + item.dependencies.map(function (id) { return esc(state.catalog.actions.find(function (x) { return x.id === id; }).title); }).join(', ') + '. Vous pouvez déjà préparer cette étape.</p>';
    var label = a.id === 'loi' && state.context.mode === 'VC' ? 'Préparer le term sheet' : actionLabels[a.id] || 'Préparer le livrable';
    html += '<div class="ppj-actions">' + (item.status === 'running' ? '<span class="ppj-live">● Préparation des documents en cours</span>' : button(result && !item.stale ? 'Actualiser les documents' : esc(label), 'ppj-primary', 'run', a.id)) +
      button('Ajouter une pièce / note', '', 'add', a.id) + button('✓ Valider l’étape', 'ppj-check-btn', 'attest', a.id) + button('Non applicable', 'ppj-quiet', 'skip', a.id) + '</div>';
    var run = state.runs[item.run_id];
    if (run) html += '<details class="ppj-run"' + (item.status === 'running' ? ' open' : '') + '><summary role="button"><span class="ppj-film-icon" aria-hidden="true">▶</span><span>' + (run.trace_expired ? 'Trace détaillée expirée' : 'Film des vérifications') + '</span></summary>' + trace(run) + '</details>';
    if (result) {
      html += '<div class="ppj-result"><h4>Vos documents</h4><p>' + esc(result.summary) + '</p>';
      if (!demo && result.required_inputs && result.required_inputs.length) {
        var fieldsMissing = result.required_inputs.filter(function (f) { return f.required && (f.value === '' || f.value == null); });
        html += fieldsMissing.length ? '<div class="ppj-notice"><b>' + fieldsMissing.length + ' information(s) à confirmer pour compléter les documents.</b><br>' + button('Compléter les informations', 'ppj-primary', 'inputs', a.id) + '</div>' : '<div class="ppj-actions">' + button('Modifier les parties ou les conditions', '', 'inputs', a.id) + '</div>';
      }
      (result.deliverables || []).forEach(function (d, i) {
        html += '<details class="ppj-deliverable"' + (i === 0 ? ' open' : '') + '><summary><span>📄 ' + esc(d.title) + '</span><small>' + (d.status === 'needs_input' ? 'À compléter' : 'Projet prêt à relire') + '</small></summary>' +
          '<div class="ppj-document-preview">' + documentHTML(d.content) + '</div><div class="ppj-actions">' +
          documentButton('Télécharger PDF', a.id, d.id, 'pdf', 'deliverable') + documentButton(d.format === 'csv' ? 'Télécharger CSV' : 'Version modifiable', a.id, d.id, d.format === 'csv' ? 'csv' : d.format === 'json' ? 'json' : 'md', 'deliverable') + documentButton('Copier le texte', a.id, d.id, '', 'copy-document') + '</div></details>';
      });
      if (!(result.deliverables || []).length) html += '<p class="ppj-notice">Ce résultat ancien ne contient pas encore de document. Actualisez cette étape pour le produire.</p>';
      html += '<details class="ppj-analysis"><summary>Analyse et sources utilisées</summary>';
      (result.sections || []).forEach(function (s) {
        html += '<details><summary>' + esc(s.title) + '</summary><p class="ppj-prose">' + esc(s.text) + '</p>';
        (s.citations || []).forEach(function (c) { html += button('Source : ' + esc((state.evidence[c.evidence_id] || {}).title || c.evidence_id), 'ppj-source', 'evidence', c.evidence_id); });
        html += '</details>';
      });
      (result.gaps || []).concat(result.coverage_limits || []).forEach(function (gap) { html += '<p class="ppj-notice">' + esc(gap) + '</p>'; });
      html += '</details>' + button(a.id === 'committee' ? 'PDF · synthèse 5 pages' : 'Rapport de l’étape en PDF', '', 'pdf', a.id) + '</div>';
    }
    if (item.validation) html += '<p class="ppj-validated">✓ ' + esc(item.validation.actor) + ' · ' + date(item.validation.at) + '<br>' + esc(item.validation.note) + '</p>';
    html += '<details class="ppj-method"><summary>Méthode, couverture et expertise</summary><p>' + esc(a.method) + '</p><p>' + esc(a.expert || 'Stan prépare le travail et ses preuves. L’investisseur conserve la décision.') + '</p>' +
      '<p>Connexions : import de documents et transcriptions disponible. Google Meet, envoi et signature : non connectés dans cet espace ; importez leurs confirmations.</p>' +
      '<p>Pour une mission externe, ajoutez vos critères et les experts connus dans une note, puis lancez la préparation.</p></details><div class="ppj-form-slot" data-slot="' + a.id + '"></div></div></article>';
    return html;
  }
  function documentButton(label, action, doc, format, command) {
    if (demo && command === 'deliverable' && window.__STAN_JOURNEY_DEMO__.file) {
      var file = window.__STAN_JOURNEY_DEMO__.file(action, doc, format);
      if (file && file.url) return '<a class="ppj-btn" href="' + esc(file.url) + '" download="' + esc(file.filename) + '">' + label + '</a>';
    }
    return '<button type="button" class="ppj-btn" data-do="' + command + '" data-id="' + esc(action) + '" data-document="' + esc(doc) + '" data-format="' + esc(format) + '">' + label + '</button>';
  }
  function documentHTML(text) {
    return String(text || '').split(/\n\s*\n/).map(function (block) {
      block = block.trim();
      var safe = esc(block).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      if (/^#{1,3} /.test(block)) return '<h4>' + safe.replace(/^#{1,3} /, '') + '</h4>';
      return '<p>' + safe.replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  function inputsForm(action) {
    var slot = content.querySelector('[data-slot="' + action + '"]'), result = state.actions[action].result;
    if (!slot || !result) return;
    var values = ((state.context.action_inputs || {})[action] || {}), group = '';
    var html = '<form data-form="inputs" data-action="' + action + '"><h4>Compléter les documents</h4><p>Confirmez les informations exactes. Elles seront réutilisées pour ce dossier.</p>';
    (result.required_inputs || []).forEach(function (f) {
      var confirmedValue = values[f.key] == null ? f.value || '' : values[f.key];
      var proposed = !confirmedValue && f.proposal_requires_confirmation && f.proposed_value;
      var currentValue = proposed ? f.proposed_value : confirmedValue;
      if (group !== f.group) { group = f.group; html += '<h4>' + esc(group || 'Informations') + '</h4>'; }
      html += '<label>' + esc(f.label);
      if (f.type === 'select') html += '<select name="' + esc(f.key) + '"' + (f.required ? ' required' : '') + '><option value="">Choisir…</option>' + (f.options || []).map(function (v) { return '<option value="' + esc(v) + '"' + (currentValue === v ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select>';
      else html += '<input name="' + esc(f.key) + '" type="' + (['date','number'].includes(f.type) ? f.type : 'text') + '"' + (f.type === 'number' ? ' step="any"' : '') + ' maxlength="1200" value="' + esc(currentValue) + '"' + (f.required ? ' required' : '') + '>';
      html += (proposed ? '<small>Proposition à confirmer · ' + esc(f.proposal_source || 'Dossier existant') + '</small>' : '') + '</label>';
    });
    slot.innerHTML = html + '<div class="ppj-actions"><button class="ppj-btn ppj-primary">Enregistrer et générer les documents</button>' + button('Annuler', '', 'cancel', action) + '</div></form>';
    slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function trace(run) {
    if (run.trace_expired) return '<p>Les opérations détaillées ont expiré après 7 jours. Le résultat et les événements métier restent dans le dossier.</p>';
    return '<ol class="ppj-trace">' + (run.trace || []).map(function (t) { return '<li><time>' + date(t.at) + '</time><span>' + esc(t.text) + '</span></li>'; }).join('') + '</ol>';
  }
  function history() {
    return '<section id="stan-histList"><h3>Du premier contrôle au closing</h3><p class="ppj-muted">Décisions, pièces et travaux enregistrés. Les traces détaillées sont disponibles pendant sept jours.</p>' +
      '<div class="ppj-actions">' + button('Exporter PDF', '', 'pdf') + button('Dossier complet et preuves', '', 'export') + '</div>' +
      '<ol class="ppj-timeline">' + state.events.slice().sort(function (a, b) { return b.at - a.at; }).map(function (e) {
        var recorded = e.run_id && state.runs[e.run_id];
        return '<li class="stan-hist-item"><time>' + date(e.at) + '</time><strong>' + esc(e.text) + '</strong><small>' + esc(e.actor) + '</small>' +
          (e.action ? button('Voir l’étape', 'ppj-quiet', 'goto', e.action) : '') +
          (recorded ? '<details class="ppj-run"><summary role="button"><span class="ppj-film-icon" aria-hidden="true">▶</span><span>Revoir les opérations enregistrées</span></summary>' + trace(recorded) + '</details>' : '') + '</li>';
      }).join('') + '</ol></section>';
  }
  function form(action, type) {
    var slot = content.querySelector('[data-slot="' + action + '"]'); if (!slot) return;
    selected.clear();
    var html = '<form data-form="' + type + '" data-action="' + action + '"><h4>' + ({ add: 'Ajouter au dossier', attest: 'Valider avec des preuves', skip: 'Expliquer la non-applicabilité' })[type] + '</h4>';
    if (type === 'add') {
      html += '<label>Type de pièce<select name="kind">' + Object.keys(state.catalog.evidence_kinds).map(function (k) { return '<option value="' + k + '">' + esc(state.catalog.evidence_kinds[k]) + '</option>'; }).join('') + '</select></label>' +
        '<label>Titre<input name="title" required maxlength="200"></label><label>Interlocuteur (pour un compte rendu de référence)<input name="subject" maxlength="180"></label><label>Source HTTPS<input name="url" type="url" placeholder="https://…"></label><label>Contenu / note / transcription<textarea name="text" rows="5"></textarea></label>' +
        '<label>Ou importer un fichier<input name="file" type="file" accept=".pdf,.xlsx,.csv,.txt,.md,.json,.vtt,.srt,.mp3,.m4a,.wav,.webm,.mp4,.ogg"></label><p class="ppj-muted">12 Mo maximum. Un audio reste à transcrire ; il ne compte pas comme contenu analysé.</p>';
    } else {
      html += '<label>' + (type === 'attest' ? 'Décision, auteur et résultat réellement constaté' : 'Motif') + '<textarea name="note" rows="4" minlength="15" required></textarea></label>';
      if (type === 'attest') {
        html += '<fieldset><legend>Pièces sur lesquelles repose la validation</legend>' + Object.values(state.evidence).map(function (e) { return '<label class="ppj-check"><input type="checkbox" name="proof" value="' + e.id + '">' + esc(e.title) + '</label>'; }).join('') + '</fieldset>';
        (state.confirmations[action] || []).forEach(function (c) { html += '<label class="ppj-check"><input type="checkbox" name="confirmation" value="' + esc(c) + '" required>' + esc(c) + '</label>'; });
      }
    }
    slot.innerHTML = html + '<div class="ppj-actions"><button class="ppj-btn ppj-primary">' + (demo ? 'Simuler' : 'Enregistrer') + '</button>' + button('Annuler', '', 'cancel', action) + '</div></form>';
    slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    slot.querySelector('input,textarea,select').focus();
  }
  async function handleSubmit(e) {
    var f = e.target.closest('form[data-form]'); if (!f) return; e.preventDefault();
    if (running) return; running = true; var submit = f.querySelector('button'); submit.disabled = true;
    try {
      var fd = new FormData(f), type = f.dataset.form, action = f.dataset.action;
      if (type === 'settings') {
        var cfg = {}; ['exclusivity_days', 'committee_notice_hours', 'board_day'].forEach(function (n) { cfg[n] = fd.get(n) === '' ? null : Number(fd.get(n)); });
        if (demo) state.settings = cfg; else await api('/command/settings', cfg);
        content.innerHTML = ''; await refresh(false);
      } else if (type === 'inputs') {
        pendingResult = action;
        var values = {}; fd.forEach(function (v, n) { values[n] = String(v).trim(); });
        if (demo) { window.__STAN_JOURNEY_DEMO__.command('inputs', { action: action, values: values }); content.innerHTML = ''; await window.__STAN_JOURNEY_DEMO__.run(action, render); }
        else { await api('/command/inputs', { action: action, values: values }); content.innerHTML = ''; await api('/actions/' + action + '/run', {}); }
        await refresh(false);
      } else {
        var data = { action: action };
        if (type === 'add') {
          ['kind', 'title', 'text', 'url', 'subject'].forEach(function (n) { data[n] = String(fd.get(n) || ''); });
          var file = fd.get('file');
          if (file && file.size) {
            if (file.size > 12 * 1024 * 1024) throw new Error('Fichier limité à 12 Mo');
            data.filename = file.name; data.mime = file.type;
            data.blob = await new Promise(function (resolve, reject) { var r = new FileReader(); r.onload = function () { resolve(String(r.result).split(',')[1]); }; r.onerror = reject; r.readAsDataURL(file); });
          }
        } else { data.note = String(fd.get('note')); data.evidence_ids = fd.getAll('proof'); data.confirmations = fd.getAll('confirmation'); }
        if (demo) window.__STAN_JOURNEY_DEMO__.command(type, data);
        else await api(type === 'add' ? '/evidence' : '/command/' + type, data);
        content.innerHTML = ''; await refresh(false);
      }
      announce(demo ? 'Simulation enregistrée dans la démonstration uniquement.' : 'Enregistré dans le dossier privé.');
    } catch (error) { announce(error.message, true); }
    finally { running = false; submit.disabled = false; }
  }
  async function download(format, action) {
    if (demo) { window.__STAN_JOURNEY_DEMO__.export(format, action); return; }
    var response = await api('/export?format=' + format + '&action=' + encodeURIComponent(action || ''));
    var blob = await response.blob(), url = URL.createObjectURL(blob);
    var link = el('a', { href: url, download: 'parcours-' + (action || 'dossier') + '.' + (format === 'zip' ? 'zip' : 'pdf') });
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  }
  async function handleClick(e) {
    var b = e.target.closest('[data-do]'); if (!b) return;
    var cmd = b.dataset.do, id = b.dataset.id;
    try {
      if (cmd === 'close') { close(); return; }
      if (cmd === 'connect') {
        if (openingDossier) return;
        memberSession = readMemberSession(); accessToken = '';
        if (memberSession) key = '';
        if (!memberSession && !key) { openAccountPopup(); return; }
        b.disabled = true;
        try { await openDossier(); }
        catch (error) { if (error.status === 401 || error.status === 403) openAccountPopup(); throw error; }
        finally { b.disabled = false; }
        return;
      }
      if (cmd === 'full') { shell.classList.toggle('ppj-full'); return; }
      if (cmd === 'roadmap' || cmd === 'history') { pane = cmd; content.innerHTML = ''; render(); return; }
      if (cmd === 'phase') { filter = filter === id ? '' : id; render(); return; }
      if (cmd === 'all') { filter = ''; search = ''; render(); return; }
      if (cmd === 'after') {
        var shown = b.getAttribute('aria-expanded') === 'true';
        afterOpen = !shown;
        if (shown) { if (afterIds().indexOf(active) >= 0) active = ''; if (AFTER_CLOSING.indexOf(filter) >= 0) filter = ''; }
        render(); return;
      }
      if (cmd === 'expand' || cmd === 'goto') {
        active = active === id && cmd === 'expand' ? '' : id; if (cmd === 'goto') { pane = 'roadmap'; filter = ''; }
        render();
        var step = cmd === 'goto' && content.querySelector('#stan-action-' + id);
        if (step && step.scrollIntoView) step.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
      if (cmd === 'inputs') { inputsForm(id); return; }
      if (cmd === 'deliverable' || cmd === 'copy-document') {
        var documentId = b.dataset.document, format = b.dataset.format;
        var doc = (state.actions[id].result.deliverables || []).find(function (d) { return d.id === documentId; });
        if (!doc) throw new Error('Document indisponible. Actualisez cette étape.');
        if (cmd === 'copy-document') {
          try { await navigator.clipboard.writeText(doc.content); }
          catch (_) {
            var copyBox = el('textarea', { 'aria-label': 'Texte du document à copier' }); copyBox.value = doc.content; shell.appendChild(copyBox); copyBox.select();
            var copied = document.execCommand('copy'); copyBox.remove(); if (!copied) throw new Error('La copie est bloquée par le navigateur. Téléchargez la version modifiable.');
          }
          announce('Texte copié, prêt à coller dans votre document ou message.'); return;
        }
        if (demo) { window.__STAN_JOURNEY_DEMO__.download(id, documentId, format); return; }
        var response = await api('/actions/' + encodeURIComponent(id) + '/deliverables/' + encodeURIComponent(documentId) + '?format=' + encodeURIComponent(format));
        var blob = await response.blob(), documentURL = URL.createObjectURL(blob), link = el('a', { href: documentURL, download: doc.filename.replace(/\.[^.]+$/, '') + '.' + format });
        document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(documentURL); }, 30000); return;
      }
      if (['add', 'attest', 'skip'].includes(cmd)) { form(id, cmd); return; }
      if (cmd === 'cancel') { content.querySelector('[data-slot="' + id + '"]').innerHTML = ''; return; }
      if (cmd === 'evidence') {
        var piece = state.evidence[id]; if (!piece) return;
        var dialog = el('dialog', { class: 'ppj-dialog' });
        dialog.innerHTML = '<h3>' + esc(piece.title) + '</h3><p>' + esc(piece.provenance) + ' · ' + date(piece.at) + '</p><pre>' + esc(piece.text || 'Audio conservé. Transcription à importer.') + '</pre>' + (piece.filename && !demo ? button('Télécharger l’original', '', 'original', id) : '') + '<button class="ppj-btn" data-close-piece>Fermer</button>';
        shell.appendChild(dialog); dialog.querySelector('[data-close-piece]').onclick = function () { dialog.close(); dialog.remove(); }; dialog.showModal(); return;
      }
      if (cmd === 'original') {
        var original = await (await api('/evidence/' + encodeURIComponent(id) + '/file')).blob();
        var originalURL = URL.createObjectURL(original), a = el('a', { href: originalURL, download: state.evidence[id].filename });
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(originalURL); }, 30000); return;
      }
      if (cmd === 'handoff' && pendingDossier) {
        await api('/evidence', { kind: 'committee', action: 'committee', title: 'Dossier comité modifié dans le cockpit', text: pendingDossier.text });
        pendingDossier = null; active = 'committee'; await refresh(false); announce('Dossier comité réutilisé avec vos modifications.'); return;
      }
      if (cmd === 'settings') {
        content.innerHTML = '<h3>Échéances et conservation</h3><form data-form="settings">' + [['exclusivity_days', 'Exclusivité (jours convenus)'], ['committee_notice_hours', 'Préavis comité (heures)'], ['board_day', 'Premier board (jours après closing)']].map(function (x) { return '<label>' + x[1] + '<input type="number" name="' + x[0] + '" min="0" max="365" value="' + esc(state.settings[x[0]]) + '"></label>'; }).join('') + '<button class="ppj-btn ppj-primary">Enregistrer</button></form><p>Pièces utiles conservées pendant le dossier. Traces techniques : 7 jours. Exportez vos preuves avant toute suppression.</p><div class="ppj-actions">' + button('Exporter les preuves', '', 'export') + button(state.archived ? 'Rouvrir' : 'Archiver', '', state.archived ? 'unarchive' : 'archive') + (state.archived ? button('Supprimer après export', '', 'purge') : '') + button('Retour au parcours', '', 'roadmap') + '</div>'; return;
      }
      if (cmd === 'archive' || cmd === 'unarchive') {
        if (demo) state.archived = cmd === 'archive'; else await api('/command/' + cmd, {});
        await refresh(false); return;
      }
      if (cmd === 'purge') {
        if (!window.confirm('Supprimer définitivement les pièces et l’historique de ce dossier archivé ? Exportez-les avant de confirmer.')) return;
        if (!demo) await api('', { confirm: state.id }, 'DELETE'); state = null; render(); return;
      }
      if (cmd === 'export' || cmd === 'pdf') { await download(cmd === 'pdf' ? 'pdf' : 'zip', id); return; }
      if (cmd === 'run') {
        pendingResult = id;
        b.disabled = true; announce('Préparation des vérifications…');
        if (demo) { await window.__STAN_JOURNEY_DEMO__.run(id, render); await refresh(false); }
        else { await api('/actions/' + id + '/run', {}); await refresh(false); }
        announce(demo ? 'Exécution fictive : aucun appel payant.' : 'Résultat réutilisé ou vérifications lancées. Le film affiche les opérations réelles.');
      }
    } catch (error) { announce(error.message, true); b.disabled = false; }
  }
  window.StanJourney = { open: open, showAction: function (id) { active = id; filter = ''; open('roadmap'); }, getState: function () { return demo ? state : null; } };
  if (!demo) window.addEventListener('message', function (e) {
    if (loginFrame && e.source === loginFrame.contentWindow && e.origin === 'https://proplace.co'
        && e.data && e.data.channel === loginChannel) {
      if (e.data.type === 'proplace:journey:login-ready') { accountFrameReady(); return; }
      if (e.data.type === 'proplace:journey:cancelled') { closeAccountPopup(); return; }
      if (e.data.type === 'proplace:journey:authenticated' && typeof e.data.session === 'string'
          && e.data.session.length < 1800 && e.data.session.indexOf('ppin1~') === 0) {
        memberSession = e.data.session; accessToken = ''; key = ''; closeAccountPopup();
        openDossier()
          .catch(function (error) { announce(error.message, true); render(); });
        return;
      }
    }
    if (e.source !== window.opener || !['https://proplace.co', 'https://www.proplace.co'].includes(e.origin)) return;
    if (e.data && e.data.type === 'proplace:journey:access') {
      if (typeof e.data.session === 'string' && e.data.session.length < 1800) memberSession = e.data.session;
      if (typeof e.data.key === 'string' && e.data.key.length < 300) key = e.data.key;
      accessToken = ''; open('roadmap'); openDossier().catch(function (error) { announce(error.message, true); }); return;
    }
    if (!e.data || e.data.type !== 'proplace:journey:dossier' || typeof e.data.text !== 'string' || e.data.text.length > 300000) return;
    pendingDossier = { text: e.data.text }; active = 'committee'; open('roadmap');
    e.source.postMessage({ type: 'proplace:journey:received' }, e.origin);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
}());
