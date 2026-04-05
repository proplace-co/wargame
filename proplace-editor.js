/* PROPLACE LIVE EDITOR - v3.6
   Usage: <script src="proplace-editor.js"
     data-webhook="WEBHOOK_URL"
     data-deal="DEAL_ID"
     data-status="STATUS_PROFUND">
   </script>

   v3.6 changes vs v3.5:
   - SAVE BUTTON: hidden by default when entering edit mode.
     Only becomes visible when the user makes an actual manual change:
     • types into any contenteditable element (first input event)
     • or clicks "Ajouter une section manuellement"
     File operations (Lier / Analyser PDF) are self-contained — they call
     the webhook immediately and do NOT need Save & Sync.

   - LINK FILE VISUAL FEEDBACK: when "Lier un fichier" webhook returns ok,
     a linked-file badge is injected immediately into the target section
     so the user sees confirmation without reloading.
     Target section is chosen dynamically from a dropdown populated with
     every .section-container found on the page (not hardcoded dd/pm).

   - LIGHTBOX REWRITE (from v3.5): pure JS show/hide, not CSS :target.
   - DOUBLE PEN FIX (from v3.4): icon/label reset independently.
   - AUTO-LIGHTBOX + HIDE EMPTY SYNERGIES: unchanged.
*/
(function () {
  'use strict';

  var currentScript = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var WEBHOOK_URL = currentScript.getAttribute('data-webhook') || '';
  var DEAL_ID     = currentScript.getAttribute('data-deal')    || '';
  var STATUS      = (currentScript.getAttribute('data-status') || 'NEW').toUpperCase();
  var editMode         = false;
  var savedHTML        = '';
  var hasManualChanges = false; /* drives Save button visibility */

  function getMainLabel() {
    if (STATUS === 'IN_PORTFOLIO') return ' Gérer le Portfolio';
    if (STATUS === 'CALL')        return ' Démarrer la Due Diligence';
    return ' Éditer le Mémo';
  }
  function getMainIcon() {
    if (STATUS === 'IN_PORTFOLIO') return '&#128202;';
    if (STATUS === 'CALL')        return '&#128270;';
    return '&#9998;';
  }

  /* ── STYLES ── */
  var style = document.createElement('style');
  style.textContent = [
    "#plEditor{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px;font-family:'EB Garamond',Georgia,serif;}",
    "#plToggle{background:#0f1f33;color:#fff;border:none;padding:11px 20px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(15,31,51,0.25);font-family:'DM Mono','Courier New',monospace;letter-spacing:0.08em;text-transform:uppercase;transition:background 0.15s;}",
    "#plToggle.editing{background:#c04a00;}",
    "#plActions{display:none;flex-direction:column;gap:6px;align-items:flex-end;}",
    ".pl-action-btn{border:none;padding:9px 16px;font-size:11px;font-weight:500;cursor:pointer;font-family:'DM Mono','Courier New',monospace;letter-spacing:0.08em;text-transform:uppercase;transition:opacity 0.15s;}",
    ".pl-action-btn:hover{opacity:0.85;}",
    ".pl-btn-save{background:#185c38;color:#fff;}",
    ".pl-btn-pdf{background:#183460;color:#fff;}",
    ".pl-btn-link{background:#526070;color:#fff;}",
    ".pl-btn-section{background:#5a3a90;color:#fff;}",
    ".pl-btn-cancel{background:#f4f5f7;color:#0b1929;border:1px solid #d4d9e2;}",
    "#plToast{position:fixed;bottom:100px;right:24px;z-index:9999;background:#0f1f33;color:#fff;padding:11px 18px;font-size:12px;opacity:0;transition:opacity 0.25s;pointer-events:none;max-width:300px;font-family:'EB Garamond',Georgia,serif;font-style:italic;line-height:1.5;}",
    "[contenteditable]:focus{outline:2px solid #8fa8c8;outline-offset:2px;background:rgba(143,168,200,0.06);}",
    "[contenteditable]:hover{outline:1px dashed #c0ccd8;}",
    ".pl-section-ctrl{display:flex;gap:6px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed #e4e7ed;}",
    ".pl-ctrl-btn{padding:3px 10px;font-size:10px;border-radius:0;border:1px solid;background:#fff;cursor:pointer;font-family:'DM Mono','Courier New',monospace;letter-spacing:0.06em;text-transform:uppercase;}",
    ".pl-hide-btn{color:#526070;border-color:#d4d9e2;}.pl-hide-btn:hover{background:#0f1f33;color:#fff;border-color:#0f1f33;}",
    ".pl-del-btn{color:#7a1824;border-color:#ddb8be;}.pl-del-btn:hover{background:#7a1824;color:#fff;}",
    ".pl-label-btn{color:#9eaaba;border-color:transparent;background:transparent;cursor:default;font-size:9px;}",
    /* file link badge */
    ".pl-file-badge{display:flex;align-items:center;gap:10px;background:#f0f8ff;border:1px solid #a8c0dc;border-left:3px solid #183460;padding:10px 14px;margin-top:12px;font-family:'EB Garamond',Georgia,serif;}",
    ".pl-file-badge .pl-fb-icon{font-size:1.1rem;flex-shrink:0;}",
    ".pl-file-badge .pl-fb-name{font-weight:600;color:#0f1f33;font-size:0.95rem;}",
    ".pl-file-badge .pl-fb-meta{font-size:0.78rem;color:#526070;font-style:italic;margin-top:2px;}",
    /* modal */
    "#plModal{position:fixed;inset:0;background:rgba(11,25,41,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;}",
    "#plModalBox{background:#fff;padding:28px;max-width:460px;width:100%;box-shadow:0 8px 40px rgba(11,25,41,0.2);border-top:3px solid #0f1f33;max-height:90vh;overflow-y:auto;}",
    "#plModalTitle{font-family:'EB Garamond',Georgia,serif;font-size:1.25rem;font-weight:600;color:#0f1f33;margin:0 0 6px;}",
    "#plModalSubtitle{font-family:'EB Garamond',Georgia,serif;font-size:0.85rem;font-style:italic;color:#526070;margin:0 0 18px;line-height:1.55;}",
    ".pl-modal-label{font-family:'DM Mono','Courier New',monospace;font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;color:#526070;display:block;margin-bottom:5px;margin-top:12px;}",
    ".pl-modal-input{width:100%;padding:9px 12px;border:1px solid #d4d9e2;font-size:14px;font-family:'EB Garamond',Georgia,serif;box-sizing:border-box;outline:none;}",
    ".pl-modal-input:focus{border-color:#0f1f33;}",
    "#plDropZone{border:2px dashed #d4d9e2;padding:24px;text-align:center;margin-top:14px;cursor:pointer;transition:border-color 0.2s,background 0.2s;}",
    "#plDropZone:hover,#plDropZone.dragover{border-color:#0f1f33;background:#f4f5f7;}",
    "#plDropZone p{font-family:'EB Garamond',Georgia,serif;font-size:0.88rem;color:#526070;margin:0;line-height:1.6;}",
    "#plDropZone strong{color:#0f1f33;}",
    "#plDropZone small{font-family:'DM Mono',monospace;font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;color:#9eaaba;display:block;margin-top:4px;}",
    "#plFileInfo{font-family:'DM Mono',monospace;font-size:0.62rem;letter-spacing:0.06em;margin-top:8px;text-align:center;min-height:16px;}",
    "#plModalActions{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;}",
    ".pl-modal-ok{background:#0f1f33;color:#fff;border:none;padding:9px 18px;font-size:11px;font-weight:500;cursor:pointer;font-family:'DM Mono','Courier New',monospace;letter-spacing:0.08em;text-transform:uppercase;}",
    ".pl-modal-ok:disabled{background:#9eaaba;cursor:not-allowed;}",
    ".pl-modal-cancel{background:#f4f5f7;color:#0b1929;border:1px solid #d4d9e2;padding:9px 18px;font-size:11px;font-weight:500;cursor:pointer;font-family:'DM Mono','Courier New',monospace;letter-spacing:0.08em;text-transform:uppercase;}",
    "@media (max-width:1000px){",
      "#plEditor{bottom:0!important;right:0!important;left:0!important;width:100%!important;padding:8px 12px 12px!important;border-top:2px solid #d4d9e2!important;background:#fff!important;box-shadow:0 -4px 20px rgba(15,31,51,0.12)!important;align-items:stretch!important;gap:4px!important;}",
      "#plToggle{width:100%!important;justify-content:center!important;box-shadow:none!important;}",
      "#plActions{width:100%!important;align-items:stretch!important;}",
      ".pl-action-btn{text-align:center!important;width:100%!important;padding:11px 16px!important;font-size:12px!important;}",
      "#plToast{bottom:auto!important;top:16px!important;right:16px!important;left:16px!important;max-width:100%!important;}",
    '}',
    '@media (max-width:1000px){body.pl-editing .content-area{padding-bottom:280px!important;}}'
  ].join('');
  document.head.appendChild(style);

  /* ═══════════════════════════════════════════════════════════════
     MANUAL CHANGE TRACKING — drives Save button visibility
  ═══════════════════════════════════════════════════════════════ */
  function markManualChange() {
    if (hasManualChanges) return;
    hasManualChanges = true;
    var btn = document.getElementById('plBtnSave');
    if (btn) btn.style.display = '';
  }

  /* ═══════════════════════════════════════════════════════════════
     SECTION LIST — for "Lier un fichier" target dropdown
     Scans all .section-container elements and returns
     [{value, label, el}] — used to populate the select dynamically.
  ═══════════════════════════════════════════════════════════════ */
  function getSectionOptions() {
    var opts = [];
    document.querySelectorAll('.section-container').forEach(function (sec, i) {
      var titleEl = sec.querySelector('.section-title, h2, h3');
      var label   = titleEl ? titleEl.textContent.trim().slice(0, 50) : ('Section ' + (i + 1));
      var id      = sec.id || ('pl-sec-target-' + i);
      if (!sec.id) sec.id = id; /* ensure addressable */
      opts.push({ value: id, label: label });
    });
    return opts;
  }

  /* ═══════════════════════════════════════════════════════════════
     INJECT FILE BADGE after successful link
  ═══════════════════════════════════════════════════════════════ */
  function injectFileBadge(fileName, sectionId, note) {
    var target = document.getElementById(sectionId) || document.querySelector('.content-area');
    if (!target) return;

    var badge = document.createElement('div');
    badge.className = 'pl-file-badge';
    var date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    badge.innerHTML =
      '<span class="pl-fb-icon">&#128279;</span>' +
      '<div>' +
        '<div class="pl-fb-name">' + escHtml(fileName) + '</div>' +
        '<div class="pl-fb-meta">' +
          'Lié le ' + date +
          (note ? ' &mdash; ' + escHtml(note) : '') +
          ' &nbsp;·&nbsp; <em>synchronisation en cours&hellip;</em>' +
        '</div>' +
      '</div>';
    target.appendChild(badge);
    /* Smooth scroll to badge so user sees it */
    setTimeout(function () { badge.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 80);
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ═══════════════════════════════════════════════════════════════
     MODAL GÉNÉRIQUE
  ═══════════════════════════════════════════════════════════════ */
  function showModal(config, callback) {
    var existing = document.getElementById('plModal'); if (existing) existing.remove();
    var modal = document.createElement('div'); modal.id = 'plModal';
    var fieldsHTML = (config.fields || []).map(function (f) {
      if (f.type === 'select') {
        var opts = (f.options || []).map(function (o) {
          return "<option value='" + escHtml(o.value) + "'>" + escHtml(o.label) + '</option>';
        }).join('');
        return "<label class='pl-modal-label'>" + f.label + "</label><select class='pl-modal-input' data-field='" + f.key + "'>" + opts + '</select>';
      }
      return "<label class='pl-modal-label'>" + f.label + "</label><input class='pl-modal-input' type='text' placeholder='" + escHtml(f.placeholder || '') + "' data-field='" + f.key + "'>";
    }).join('');
    modal.innerHTML = "<div id='plModalBox'><h2 id='plModalTitle'>" + config.title + '</h2>' +
      (config.subtitle ? "<p id='plModalSubtitle'>" + config.subtitle + '</p>' : '') +
      fieldsHTML +
      "<div id='plModalActions'><button class='pl-modal-cancel'>Annuler</button><button class='pl-modal-ok'>" + (config.okLabel || 'Confirmer') + '</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('.pl-modal-cancel').onclick = function () { modal.remove(); };
    modal.onclick = function (e) { if (e.target === modal) modal.remove(); };
    modal.querySelector('.pl-modal-ok').onclick = function () {
      var result = {};
      modal.querySelectorAll('[data-field]').forEach(function (el) { result[el.getAttribute('data-field')] = el.value; });
      modal.remove(); callback(result);
    };
    var first = modal.querySelector('input,select'); if (first) setTimeout(function () { first.focus(); }, 50);
  }

  /* ═══════════════════════════════════════════════════════════════
     MODAL PDF UPLOAD
  ═══════════════════════════════════════════════════════════════ */
  function showPDFModal() {
    var existing = document.getElementById('plModal'); if (existing) existing.remove();
    var selectedFile = null, selectedBase64 = null;
    var modal = document.createElement('div'); modal.id = 'plModal';
    modal.innerHTML = [
      "<div id='plModalBox'>",
        "<h2 id='plModalTitle'>&#128196; Analyser un document PDF</h2>",
        "<p id='plModalSubtitle'>Stan va <strong>lire et analyser le contenu complet du PDF</strong>, puis mettre à jour automatiquement la section Due Diligence ou Portfolio de ce mémo. <strong>PDF uniquement.</strong></p>",
        "<div id='plDropZone'><p>&#128196; <strong>Cliquez ici</strong> ou glissez-déposez votre PDF</p><small>PDF uniquement &middot; Max 10 Mo</small></div>",
        "<div id='plFileInfo'></div>",
        "<label class='pl-modal-label' style='margin-top:16px;'>Note (optionnel — apparaîtra dans le mémo)</label>",
        "<input class='pl-modal-input' type='text' id='plPdfNote' placeholder='Ex : Term sheet Partech — version finale'>",
        "<div id='plModalActions'><button class='pl-modal-cancel'>Annuler</button><button class='pl-modal-ok' id='plPdfConfirm' disabled>Envoyer à Stan &#x2192;</button></div>",
      "</div>"
    ].join('');
    document.body.appendChild(modal);
    var fi = document.createElement('input'); fi.type='file'; fi.accept='.pdf,application/pdf'; fi.style.display='none'; document.body.appendChild(fi);
    var dz=document.getElementById('plDropZone'), inf=document.getElementById('plFileInfo'), cb=document.getElementById('plPdfConfirm');
    function hf(file) {
      if (!file||file.type!=='application/pdf'){inf.style.color='#7a1824';inf.textContent='\u26a0 PDF uniquement.';return;}
      inf.style.color='#526070';inf.textContent='Lecture\u2026';
      var r=new FileReader(); r.onload=function(ev){selectedFile=file;selectedBase64=ev.target.result.split(',')[1];inf.style.color='#185c38';inf.textContent='\u2713 '+file.name+' ('+Math.round(file.size/1024)+' Ko)';cb.disabled=false;};
      r.onerror=function(){inf.style.color='#7a1824';inf.textContent='\u26a0 Erreur de lecture.';};r.readAsDataURL(file);
    }
    dz.onclick=function(){fi.click();}; fi.onchange=function(e){if(e.target.files[0])hf(e.target.files[0]);fi.value='';};
    dz.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('dragover');}); dz.addEventListener('dragleave',function(){dz.classList.remove('dragover');});
    dz.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('dragover');if(e.dataTransfer.files[0])hf(e.dataTransfer.files[0]);});
    function cl(){modal.remove();fi.remove();} modal.querySelector('.pl-modal-cancel').onclick=cl; modal.onclick=function(e){if(e.target===modal)cl();};
    cb.onclick=function(){
      if(!selectedBase64)return;
      var note=document.getElementById('plPdfNote').value||''; cl();
      plShowToast('Envoi à Stan\u2026 mise à jour dans 30–60 s.');
      fetch(WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deal_id:DEAL_ID,source:'document_upload',file_base64:selectedBase64,file_name:selectedFile.name,file_type:selectedFile.type,note:note,updated_at:new Date().toISOString()})})
        .then(function(r){if(r.ok)plShowToast('\u2713 Reçu — rechargez dans 60 s.');else plShowToast('Erreur serveur — réessayez');})
        .catch(function(){plShowToast('Connexion échouée — vérifiez le webhook');});
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     MODAL LIER UN FICHIER — section dropdown built dynamically
     from actual page sections. On success: injects a visual badge
     directly into the chosen section; no Save needed.
  ═══════════════════════════════════════════════════════════════ */
  function showLinkFileModal() {
    var existing = document.getElementById('plModal'); if (existing) existing.remove();
    var selectedFile = null, selectedBase64 = null;

    /* Build section options from live DOM */
    var sectionOpts = getSectionOptions();
    var sectionOptsHTML = sectionOpts.map(function (o) {
      return "<option value='" + escHtml(o.value) + "'>" + escHtml(o.label) + '</option>';
    }).join('');

    var modal = document.createElement('div'); modal.id = 'plModal';
    modal.innerHTML = [
      "<div id='plModalBox'>",
        "<h2 id='plModalTitle'>&#128279; Lier un fichier (sans analyse)</h2>",
        "<p id='plModalSubtitle'>Le fichier sera <strong>sauvegardé dans Drive</strong> et un badge sera ajouté immédiatement dans la section choisie. <strong>Aucune analyse IA.</strong> Tous formats acceptés (PDF, Excel, Word, images…).</p>",
        "<div id='plDropZone'><p>&#128194; <strong>Cliquez ici</strong> ou glissez-déposez votre fichier</p><small>Tous formats &middot; Max 20 Mo</small></div>",
        "<div id='plFileInfo'></div>",
        "<label class='pl-modal-label' style='margin-top:16px;'>Section de destination</label>",
        "<select class='pl-modal-input' id='plLinkSection'>" + sectionOptsHTML + "</select>",
        "<label class='pl-modal-label'>Note sur ce fichier (optionnel)</label>",
        "<input class='pl-modal-input' type='text' id='plLinkNote' placeholder='Ex : Modèle financier Q1 2025 — version définitive'>",
        "<div id='plModalActions'><button class='pl-modal-cancel'>Annuler</button><button class='pl-modal-ok' id='plLinkConfirm' disabled>Lier le fichier &#x2192;</button></div>",
      "</div>"
    ].join('');
    document.body.appendChild(modal);
    var fi = document.createElement('input'); fi.type='file'; fi.style.display='none'; document.body.appendChild(fi);
    var dz=document.getElementById('plDropZone'), inf=document.getElementById('plFileInfo'), cb=document.getElementById('plLinkConfirm');
    function hf(file){
      if(!file)return; inf.style.color='#526070'; inf.textContent='Lecture\u2026';
      var r=new FileReader(); r.onload=function(ev){selectedFile=file;selectedBase64=ev.target.result.split(',')[1];inf.style.color='#185c38';inf.textContent='\u2713 '+file.name+' ('+Math.round(file.size/1024)+' Ko)';cb.disabled=false;};
      r.onerror=function(){inf.style.color='#7a1824';inf.textContent='\u26a0 Erreur de lecture.';};r.readAsDataURL(file);
    }
    dz.onclick=function(){fi.click();}; fi.onchange=function(e){if(e.target.files[0])hf(e.target.files[0]);fi.value='';};
    dz.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('dragover');}); dz.addEventListener('dragleave',function(){dz.classList.remove('dragover');});
    dz.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('dragover');if(e.dataTransfer.files[0])hf(e.dataTransfer.files[0]);});
    function cl(){modal.remove();fi.remove();} modal.querySelector('.pl-modal-cancel').onclick=cl; modal.onclick=function(e){if(e.target===modal)cl();};
    cb.onclick=function(){
      if(!selectedBase64)return;
      var note    = document.getElementById('plLinkNote').value    || '';
      var section = document.getElementById('plLinkSection').value || '';
      cl();
      plShowToast('Envoi en cours\u2026');
      fetch(WEBHOOK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deal_id:DEAL_ID,source:'link_file',file_base64:selectedBase64,file_name:selectedFile.name,file_type:selectedFile.type,section:section,note:note,updated_at:new Date().toISOString()})})
        .then(function(r){
          if(r.ok){
            /* ── Immediate visual feedback in the chosen section ── */
            injectFileBadge(selectedFile.name, section, note);
            plShowToast('\u2713 Fichier lié — badge ajouté dans la section');
          } else {
            plShowToast('Erreur serveur — réessayez');
          }
        })
        .catch(function(){plShowToast('Connexion échouée — vérifiez le webhook');});
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     INIT EDITOR UI
  ═══════════════════════════════════════════════════════════════ */
  function init() {
    if (document.getElementById('plEditor')) return;
    var fab = document.createElement('div'); fab.id = 'plEditor';
    fab.innerHTML = [
      "<button id='plToggle' onclick='plToggleEdit()'>",
        "<span id='plIcon'>" + getMainIcon() + "</span>",
        "<span id='plLabel'>" + getMainLabel() + "</span>",
      "</button>",
      "<div id='plActions'>",
        /* Save button: hidden initially, shown only when manual changes exist */
        "<button id='plBtnSave' class='pl-action-btn pl-btn-save' onclick='plSaveChanges()' style='display:none;'>&#128190; Sauvegarder &amp; Sync</button>",
        "<button class='pl-action-btn pl-btn-pdf'     onclick='plOpenPDFUpload()'>&#128196; Analyser un document PDF</button>",
        "<button class='pl-action-btn pl-btn-link'    onclick='plAttachLink()'>&#128279; Lier un fichier (sans analyse)</button>",
        "<button class='pl-action-btn pl-btn-section' onclick='plAddSection()'>+ Ajouter une section manuellement</button>",
        "<button class='pl-action-btn pl-btn-cancel'  onclick='plCancelEdit()'>&#x2715; Annuler</button>",
      "</div>",
      "<div id='plToast'></div>"
    ].join('');
    document.body.appendChild(fab);
    initAutoLightbox();
    initLightboxHandlers();
    hideEmptySynergies();
  }

  /* ═══════════════════════════════════════════════════════════════
     EDITOR ACTIONS
  ═══════════════════════════════════════════════════════════════ */
  window.plToggleEdit = function () {
    editMode = !editMode;
    if (editMode) {
      var editorEl = document.getElementById('plEditor'), editorParent = editorEl ? editorEl.parentNode : null;
      if (editorEl && editorParent) editorEl.remove();
      savedHTML = document.documentElement.outerHTML;
      if (editorEl && editorParent) editorParent.appendChild(editorEl);
      plEnableEditing();
    } else {
      plCancelEdit();
    }
  };
  window.plOpenPDFUpload = function () { showPDFModal(); };
  window.plAttachLink    = function () { showLinkFileModal(); };

  function plEnableEditing() {
    document.getElementById('plToggle').classList.add('editing');
    document.getElementById('plLabel').textContent = " En cours d'\u00e9dition\u2026";
    document.getElementById('plActions').style.display = 'flex';
    /* Save button stays hidden — will appear on first manual change */
    hasManualChanges = false;
    var saveBtn = document.getElementById('plBtnSave');
    if (saveBtn) saveBtn.style.display = 'none';
    document.body.classList.add('pl-editing');

    var sel = '.content-area p,.content-area h1,.content-area h2,.content-area h3,.content-area h4,.content-area li,.content-area td,.content-area b,.content-area span.text-block,.content-area div.text-block';
    document.querySelectorAll(sel).forEach(function (el) {
      if (el.closest('#plEditor') || el.closest('#plModal')) return;
      el.setAttribute('contenteditable', 'true');
      el.style.cursor = 'text';
      /* Show Save on first keystroke */
      el.addEventListener('input', markManualChange, { once: true });
    });

    document.querySelectorAll('.section-container').forEach(function (sec) {
      if (sec.querySelector('.pl-section-ctrl')) return;
      var title = sec.querySelector('.section-title'), name = title ? title.textContent.trim().slice(0, 36) : 'Section';
      var ctrl = document.createElement('div'); ctrl.className = 'pl-section-ctrl';
      ctrl.innerHTML =
        "<button class='pl-ctrl-btn pl-hide-btn' data-hidden='false' onclick='plToggleSection(this)'>&#128065; Masquer</button>" +
        "<button class='pl-ctrl-btn pl-del-btn' onclick='plDeleteSection(this)'>&#x2715; Supprimer</button>" +
        "<span class='pl-ctrl-btn pl-label-btn'>" + name + '</span>';
      sec.insertBefore(ctrl, sec.firstChild);
    });
  }

  window.plToggleSection = function (btn) {
    var sec = btn.closest('.section-container'), hidden = btn.dataset.hidden === 'true';
    Array.from(sec.children).forEach(function (c) {
      if (!c.classList.contains('pl-section-ctrl')) { c.style.opacity = hidden ? '1' : '0.1'; c.style.pointerEvents = hidden ? '' : 'none'; }
    });
    btn.dataset.hidden = hidden ? 'false' : 'true';
    btn.textContent = hidden ? '\ud83d\udc41 Masquer' : '\ud83d\udeab Masqué';
    btn.style.background = hidden ? '' : '#0f1f33'; btn.style.color = hidden ? '' : '#fff';
  };

  window.plDeleteSection = function (btn) {
    var sec = btn.closest('.section-container'), t = sec.querySelector('.section-title');
    showModal({ title: 'Supprimer \u201c' + (t ? t.textContent.trim() : 'cette section') + '\u201d ?', fields: [] }, function () { sec.remove(); plShowToast('Section supprimée'); });
  };

  window.plAddSection = function () {
    showModal({
      title: 'Ajouter une section',
      fields: [
        { key: 'type', label: 'Type', type: 'select', options: [
          { value: 'text',  label: 'Texte libre' },
          { value: 'table', label: 'Tableau financier' },
          { value: 'flags', label: 'Risk flags & signaux' }
        ]},
        { key: 'title', label: 'Titre', placeholder: 'Ex : Notes de Due Diligence' }
      ]
    }, function (res) {
      if (!res.type) return;
      var sec = document.createElement('div'); sec.className = 'section-container';
      if (res.type === 'text') {
        sec.innerHTML = "<h2 class='section-title' contenteditable='true'>" + (res.title || 'Nouvelle Section') + "</h2><p class='text-block' contenteditable='true' style='line-height:1.75;'>Rédigez votre contenu ici\u2026</p>";
      } else if (res.type === 'table') {
        sec.innerHTML = "<h2 class='section-title' contenteditable='true'>" + (res.title || 'Tableau Financier') + "</h2><div style='overflow-x:auto;'><table style='width:100%;border-collapse:collapse;font-size:0.9rem;'><thead><tr style='background:#0f1f33;'><th contenteditable='true' style='padding:10px;text-align:left;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;'>Métrique</th><th contenteditable='true' style='padding:10px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;'>Y1</th><th contenteditable='true' style='padding:10px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;'>Y2</th><th contenteditable='true' style='padding:10px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;'>Y3</th></tr></thead><tbody><tr><td contenteditable='true' style='padding:10px;border-bottom:1px solid #e4e7ed;font-weight:600;'>Revenu (M\u20ac)</td><td contenteditable='true' style='padding:10px;border-bottom:1px solid #e4e7ed;font-family:DM Mono,monospace;'>\u2014</td><td contenteditable='true' style='padding:10px;border-bottom:1px solid #e4e7ed;font-family:DM Mono,monospace;'>\u2014</td><td contenteditable='true' style='padding:10px;border-bottom:1px solid #e4e7ed;font-family:DM Mono,monospace;'>\u2014</td></tr></tbody></table></div>";
      } else if (res.type === 'flags') {
        sec.innerHTML = "<h2 class='section-title' contenteditable='true'>" + (res.title || 'Risk Flags') + "</h2><div style='background:#faf0f1;border-left:3px solid #7a1824;padding:12px 15px;font-size:0.92rem;color:#7a1824;margin-bottom:10px;font-style:italic;' contenteditable='true'>\u26a0 Nouveau risk flag</div><div style='background:#f0faf5;border-left:3px solid #185c38;padding:12px 15px;font-size:0.92rem;color:#185c38;font-style:italic;' contenteditable='true'>\u2705 Signal positif</div>";
      }
      document.querySelector('.content-area').appendChild(sec);
      plShowToast('Section ajoutée');
      /* Mark as changed → show Save button */
      markManualChange();
      setTimeout(function () { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    });
  };

  window.plSaveChanges = function () {
    plShowToast('Sauvegarde en cours\u2026');
    var clone = document.documentElement.cloneNode(true);
    ['#plEditor', '#plToast', '#plModal'].forEach(function (s) { var el = clone.querySelector(s); if (el) el.remove(); });
    clone.querySelectorAll('.pl-section-ctrl').forEach(function (el) { el.remove(); });
    clone.querySelectorAll('[contenteditable]').forEach(function (el) {
      el.removeAttribute('contenteditable'); el.style.cursor = el.style.outline = el.style.background = '';
    });
    if (clone.body) clone.body.classList.remove('pl-editing');
    var html = '<!DOCTYPE html>\n' + clone.outerHTML;
    fetch(WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal_id: DEAL_ID, updated_html: html, updated_at: new Date().toISOString(), source: 'live_editor' }) })
      .then(function (r) { if (r.ok) { plShowToast('\u2713 Sauvegardé et synchronisé'); plExitEditMode(); } else { plShowToast('Erreur serveur — réessayez'); } })
      .catch(function () { plShowToast('Connexion échouée'); });
  };

  /* v3.3: DOMParser instead of document.write */
  window.plCancelEdit = function () {
    if (savedHTML) {
      try {
        var parser = new DOMParser(), savedDoc = parser.parseFromString(savedHTML, 'text/html');
        var sc = savedDoc.querySelector('.content-area'), cc = document.querySelector('.content-area');
        if (sc && cc) cc.innerHTML = sc.innerHTML;
      } catch (e) {}
    }
    plExitEditMode(); savedHTML = '';
  };

  function plExitEditMode() {
    editMode = false; hasManualChanges = false;
    document.body.classList.remove('pl-editing');
    var toggle = document.getElementById('plToggle'); if (toggle) toggle.classList.remove('editing');
    /* v3.4: reset icon/label independently to avoid double pen */
    var icon = document.getElementById('plIcon'); if (icon) icon.innerHTML = getMainIcon();
    var lbl  = document.getElementById('plLabel'); if (lbl)  lbl.textContent = getMainLabel();
    var acts = document.getElementById('plActions'); if (acts) acts.style.display = 'none';
    var saveBtn = document.getElementById('plBtnSave'); if (saveBtn) saveBtn.style.display = 'none';
    document.querySelectorAll('[contenteditable]').forEach(function (el) {
      if (!el.closest('#plEditor')) { el.removeAttribute('contenteditable'); el.style.cursor = el.style.outline = el.style.background = ''; }
    });
    document.querySelectorAll('.pl-section-ctrl').forEach(function (el) { el.remove(); });
  }

  function plShowToast(msg) {
    var t = document.getElementById('plToast'); if (!t) return;
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(window._plTimer);
    window._plTimer = setTimeout(function () { t.style.opacity = '0'; }, 4500);
  }

  /* ═══════════════════════════════════════════════════════════════
     LIGHTBOX — PURE JS (v3.5 approach, unchanged)
  ═══════════════════════════════════════════════════════════════ */
  function initAutoLightbox() {
    document.querySelectorAll('.sticky-img').forEach(function (img, i) {
      if (img.closest('.zoom-trigger') || img.closest('.img-lightbox')) return;
      var id = 'lb-auto-' + i;
      var overlay = document.createElement('div');
      overlay.className = 'img-lightbox'; overlay.id = id; overlay.style.display = 'none';
      overlay.innerHTML = '<a href="#" class="lb-close">&times;</a><img src="' + img.src + '" alt="' + (img.alt || '') + '">';
      document.body.appendChild(overlay);
      var trigger = document.createElement('a'); trigger.href = '#' + id; trigger.className = 'zoom-trigger';
      img.parentNode.insertBefore(trigger, img); trigger.appendChild(img);
    });
  }

  function initLightboxHandlers() {
    document.querySelectorAll('a.zoom-trigger').forEach(function (trigger) {
      if (trigger.dataset.plLbReady) return; trigger.dataset.plLbReady = '1';
      trigger.addEventListener('click', function (e) {
        var href = trigger.getAttribute('href') || ''; if (!href.startsWith('#')) return;
        var lb = document.getElementById(href.slice(1)); if (!lb || !lb.classList.contains('img-lightbox')) return;
        e.preventDefault(); lb.style.display = 'flex';
      });
    });
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.lb-close');
      if (btn) {
        e.preventDefault();
        var y = window.scrollY, lb = btn.closest('.img-lightbox');
        if (lb) lb.style.display = 'none';
        if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
        window.scrollTo(0, y); return;
      }
      if (e.target.classList && e.target.classList.contains('img-lightbox')) {
        var y = window.scrollY; e.target.style.display = 'none';
        if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
        window.scrollTo(0, y);
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     HIDE EMPTY SYNERGIES (unchanged)
  ═══════════════════════════════════════════════════════════════ */
  function hideEmptySynergies() {
    var section = document.getElementById('synergies-custom'); if (!section) return;
    var title = section.querySelector('.section-title'); if (!title) return;
    var text = (title.textContent || title.innerText || '').trim();
    var isEmpty = /\band\s*$|\bet\s*$|\bund\s*$|\by\s*$|\be\s*$/i.test(text)
               || /undefined|null|\{\{/i.test(text)
               || text.replace(/[^a-z]/gi, '').length < 5;
    if (!isEmpty) return;
    section.style.display = 'none';
    var navLink = document.querySelector('a[href="#synergies-custom"]'); if (navLink) navLink.style.display = 'none';
    document.querySelectorAll('.sb-nav-heading').forEach(function (h) {
      var next = h.nextElementSibling;
      if (next && next.getAttribute('href') === '#synergies-custom' && next.style.display === 'none') h.style.display = 'none';
    });
  }

  /* BOOT */
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
