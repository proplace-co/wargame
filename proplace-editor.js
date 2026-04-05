/* PROPLACE LIVE EDITOR - v3.6
   Base : v3.5 (lightbox rewrite, double pen fix, auto-lightbox, hide empty synergies)
   Added from v3.4:
   - "Ajouter une section" : champ "Insérer" dynamique listant toutes les sections
     existantes du mémo → insertion précise après la section choisie
   - "Lier un fichier"    : select "Section" construit dynamiquement à partir du DOM
     (toutes les sections, plus seulement DD / Portfolio Company)
*/
(function() {
  'use strict';

  var currentScript = document.currentScript || (function() {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();
  var WEBHOOK_URL = currentScript.getAttribute("data-webhook") || "";
  var DEAL_ID     = currentScript.getAttribute("data-deal")    || "";
  var STATUS      = (currentScript.getAttribute("data-status") || "NEW").toUpperCase();
  var PDFCO_KEY   = currentScript.getAttribute("data-pdfco-key") || "";
  var editMode    = false;
  var savedHTML   = "";

  function getMainLabel() {
    if (STATUS === "IN_PORTFOLIO") return " Gérer le Portfolio";
    if (STATUS === "CALL")        return " Démarrer la Due Diligence";
    return " Éditer le Mémo";
  }
  function getMainIcon() {
    if (STATUS === "IN_PORTFOLIO") return "&#128202;";
    if (STATUS === "CALL")        return "&#128270;";
    return "&#9998;";
  }

  /* STYLES */
  var style = document.createElement("style");
  style.textContent = [
    "#plEditor{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px;font-family:'EB Garamond',Georgia,serif;}",
    "#plToggle{background:#0f1f33;color:#fff;border:none;padding:11px 20px;font-size:13px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(15,31,51,0.25);font-family:'DM Mono','Courier New',monospace;letter-spacing:0.08em;text-transform:uppercase;transition:background 0.15s;}",
    "#plToggle.editing{background:#c04a00;}",
    "#plActions{display:none;flex-direction:column;gap:6px;align-items:flex-end;}",
    ".pl-action-btn{border:none;padding:9px 16px;font-size:11px;font-weight:500;cursor:pointer;font-family:'DM Mono','Courier New',monospace;letter-spacing:0.08em;text-transform:uppercase;transition:opacity 0.15s;}",
    ".pl-action-btn:hover{opacity:0.85;}",
    ".pl-btn-save{background:#185c38;color:#fff;}.pl-btn-pdf{background:#183460;color:#fff;}.pl-btn-link{background:#526070;color:#fff;}.pl-btn-section{background:#5a3a90;color:#fff;}.pl-btn-cancel{background:#f4f5f7;color:#0b1929;border:1px solid #d4d9e2;}",
    "#plToast{position:fixed;bottom:100px;right:24px;z-index:9999;background:#0f1f33;color:#fff;padding:11px 18px;font-size:12px;opacity:0;transition:opacity 0.25s;pointer-events:none;max-width:300px;font-family:'EB Garamond',Georgia,serif;font-style:italic;line-height:1.5;}",
    "[contenteditable]:focus{outline:2px solid #8fa8c8;outline-offset:2px;background:rgba(143,168,200,0.06);}",
    "[contenteditable]:hover{outline:1px dashed #c0ccd8;}",
    ".pl-section-ctrl{display:flex;gap:6px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed #e4e7ed;}",
    ".pl-ctrl-btn{padding:3px 10px;font-size:10px;border-radius:0;border:1px solid;background:#fff;cursor:pointer;font-family:'DM Mono','Courier New',monospace;letter-spacing:0.06em;text-transform:uppercase;}",
    ".pl-hide-btn{color:#526070;border-color:#d4d9e2;}.pl-hide-btn:hover{background:#0f1f33;color:#fff;border-color:#0f1f33;}",
    ".pl-del-btn{color:#7a1824;border-color:#ddb8be;}.pl-del-btn:hover{background:#7a1824;color:#fff;}",
    ".pl-label-btn{color:#9eaaba;border-color:transparent;background:transparent;cursor:default;font-size:9px;}",
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
    "}",
    "@media (max-width:1000px){body.pl-editing .content-area{padding-bottom:280px!important;}}"
  ].join("");
  document.head.appendChild(style);

  /* ── HELPER : liste dynamique des sections du mémo ── */
  function buildSectionOptions() {
    var opts = [];
    document.querySelectorAll(".section-container").forEach(function(sec) {
      var titleEl = sec.querySelector(".section-title");
      if (!titleEl) return;
      var label = titleEl.textContent.trim().slice(0, 50);
      var id    = sec.id || "__sec_" + label.toLowerCase().replace(/[^a-z0-9]/g, "_");
      if (!sec.dataset.plId) sec.dataset.plId = id;
      opts.push({ value: id, label: label, node: sec });
    });
    return opts;
  }

  /* MODAL GÉNÉRIQUE */
  function showModal(config, callback) {
    var existing = document.getElementById("plModal"); if (existing) existing.remove();
    var modal = document.createElement("div"); modal.id = "plModal";
    var fieldsHTML = (config.fields || []).map(function(f) {
      if (f.type === "select") {
        var opts = f.options.map(function(o) { return "<option value='" + o.value + "'>" + o.label + "</option>"; }).join("");
        return "<label class='pl-modal-label'>" + f.label + "</label><select class='pl-modal-input' data-field='" + f.key + "'>" + opts + "</select>";
      }
      return "<label class='pl-modal-label'>" + f.label + "</label><input class='pl-modal-input' type='text' placeholder='" + (f.placeholder || "") + "' data-field='" + f.key + "'>";
    }).join("");
    modal.innerHTML = "<div id='plModalBox'><h2 id='plModalTitle'>" + config.title + "</h2>" + (config.subtitle ? "<p id='plModalSubtitle'>" + config.subtitle + "</p>" : "") + fieldsHTML + "<div id='plModalActions'><button class='pl-modal-cancel'>Annuler</button><button class='pl-modal-ok'>" + (config.okLabel || "Confirmer") + "</button></div></div>";
    document.body.appendChild(modal);
    modal.querySelector(".pl-modal-cancel").onclick = function() { modal.remove(); };
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    modal.querySelector(".pl-modal-ok").onclick = function() {
      var result = {}; modal.querySelectorAll("[data-field]").forEach(function(el) { result[el.getAttribute("data-field")] = el.value; }); modal.remove(); callback(result);
    };
    var first = modal.querySelector("input,select"); if (first) setTimeout(function() { first.focus(); }, 50);
  }

  /* MODAL PDF UPLOAD */
  function showPDFModal() {
    if (!WEBHOOK_URL) {
      alert("⚠️ Webhook non configuré — l'attribut data-webhook est manquant sur la balise <script>.");
      return;
    }
    var existing = document.getElementById("plModal"); if (existing) existing.remove();
    var selectedFile = null, selectedBase64 = null;

    /* Seuil fallback si pas de clé PDF.co */
    var DIRECT_LIMIT = 3 * 1024 * 1024;
    var hasPdfco = !!PDFCO_KEY;

    var sizeHint = hasPdfco
      ? "PDF uniquement &middot; Taille illimitée"
      : "PDF uniquement &middot; Max 3 Mo sans clé PDF.co";

    var modal = document.createElement("div"); modal.id = "plModal";
    modal.innerHTML = [
      "<div id='plModalBox'>",
        "<h2 id='plModalTitle'>&#128196; Analyser un document PDF</h2>",
        "<p id='plModalSubtitle'>Stan va <strong>analyser le PDF</strong> et mettre à jour la section Due Diligence ou Portfolio automatiquement.</p>",
        "<div id='plDropZone'>",
          "<p>&#128196; <strong>Cliquez ici</strong> ou glissez-déposez votre PDF</p>",
          "<small>" + sizeHint + "</small>",
        "</div>",
        "<div id='plFileInfo'></div>",
        "<label class='pl-modal-label' style='margin-top:16px;'>Note (optionnel)</label>",
        "<input class='pl-modal-input' type='text' id='plPdfNote' placeholder='Ex : Term sheet Partech v finale'>",
        "<div id='plModalActions'>",
          "<button class='pl-modal-cancel'>Annuler</button>",
          "<button class='pl-modal-ok' id='plPdfConfirm' disabled>Envoyer &#x2192;</button>",
        "</div>",
      "</div>"
    ].join("");
    document.body.appendChild(modal);

    var fi = document.createElement("input"); fi.type="file"; fi.accept=".pdf,application/pdf"; fi.style.display="none"; document.body.appendChild(fi);
    var dz=document.getElementById("plDropZone"), inf=document.getElementById("plFileInfo"), cb=document.getElementById("plPdfConfirm");

    function hf(file) {
      if (!file || file.type !== "application/pdf") {
        inf.style.color="#7a1824"; inf.textContent="\u26a0 PDF uniquement."; return;
      }
      /* Bloquer uniquement si pas de clé PDF.co ET fichier > 3 Mo */
      if (!hasPdfco && file.size > DIRECT_LIMIT) {
        inf.style.color="#7a1824";
        inf.textContent="\u26a0 " + Math.round(file.size/1024) + " Ko \u2014 trop lourd sans PDF.co key. Compressez via smallpdf.com ou ajoutez data-pdfco-key.";
        cb.disabled=true; selectedFile=null; selectedBase64=null; return;
      }
      inf.style.color="#526070"; inf.textContent="Lecture\u2026";
      var r = new FileReader();
      r.onload=function(ev){
        selectedFile=file;
        selectedBase64=ev.target.result.split(",")[1];
        var sizeStr = Math.round(file.size/1024) + " Ko";
        var note2 = hasPdfco ? " \u2014 via PDF.co" : "";
        inf.style.color="#185c38";
        inf.textContent="\u2713 "+file.name+" ("+sizeStr+")" + note2;
        cb.disabled=false;
      };
      r.onerror=function(){inf.style.color="#7a1824";inf.textContent="\u26a0 Erreur de lecture.";};
      r.readAsDataURL(file);
    }

    dz.onclick=function(){fi.click();};
    fi.onchange=function(e){if(e.target.files[0])hf(e.target.files[0]);fi.value="";};
    dz.addEventListener("dragover",function(e){e.preventDefault();dz.classList.add("dragover");});
    dz.addEventListener("dragleave",function(){dz.classList.remove("dragover");});
    dz.addEventListener("drop",function(e){e.preventDefault();dz.classList.remove("dragover");if(e.dataTransfer.files[0])hf(e.dataTransfer.files[0]);});

    function cl(){modal.remove();fi.remove();}
    modal.querySelector(".pl-modal-cancel").onclick=cl;
    modal.onclick=function(e){if(e.target===modal)cl();};

    cb.onclick=function(){
      if(!selectedBase64||!selectedFile)return;
      var note=document.getElementById("plPdfNote").value||"";
      cl();

    cb.onclick=function(){
      if(!selectedBase64||!selectedFile)return;
      var note=document.getElementById("plPdfNote").value||"";
      cl();

      if (!hasPdfco) {
        plShowToast("\u26a0 Cl\u00e9 PDF.co manquante \u2014 ajoutez data-pdfco-key sur la balise script");
        return;
      }

      plShowToast("Upload en cours\u2026");
      fetch("https://api.pdf.co/v1/file/upload/base64", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":PDFCO_KEY},
        body:JSON.stringify({name:selectedFile.name,file:selectedBase64})
      })
      .then(function(r){return r.json();})
      .then(function(data){
        if(!data.url){plShowToast("\u26a0 PDF.co \u00e9chou\u00e9 : "+(data.message||"erreur"));return;}
        plShowToast("Analyse en cours\u2026 (30-60s)");
        return fetch(WEBHOOK_URL,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            deal_id:DEAL_ID,
            source:"document_upload",
            file_url:data.url,
            file_name:selectedFile.name,
            file_type:selectedFile.type,
            note:note,
            updated_at:new Date().toISOString()
          })
        });
      })
      .then(function(r){
        if(r&&r.ok)plShowToast("\u2713 Re\u00e7u \u2014 rechargez dans 60s.");
        else if(r)plShowToast("Erreur serveur ("+r.status+")");
      })
      .catch(function(){
        plShowToast(!navigator.onLine?"\u26a0 Pas de connexion":"\u26a0 \u00c9chou\u00e9 \u2014 v\u00e9rifiez la cl\u00e9 PDF.co et Make");
      });
    };
  }

  /* MODAL LIER UN FICHIER — v3.6: options dynamiques depuis le DOM */
  function showLinkFileModal() {
    var existing = document.getElementById("plModal"); if (existing) existing.remove();
    var selectedFile = null, selectedBase64 = null;

    /* Construire les options de section dynamiquement */
    var sectionOpts = buildSectionOptions();
    var sectionOptsHTML = sectionOpts.length
      ? sectionOpts.map(function(o) { return "<option value='" + o.value + "'>" + o.label + "</option>"; }).join("")
      : "<option value='dd'>Due Diligence</option><option value='pm'>Portfolio Company</option>";

    var modal = document.createElement("div"); modal.id = "plModal";
    modal.innerHTML = [
      "<div id='plModalBox'>",
        "<h2 id='plModalTitle'>&#128279; Lier un fichier (sans analyse)</h2>",
        "<p id='plModalSubtitle'>Le fichier sera <strong>sauvegardé dans Drive</strong> et un lien sera ajouté dans la section choisie. <strong>Aucune analyse IA.</strong> Tous formats acceptés.</p>",
        "<div id='plDropZone'>",
          "<p>&#128194; <strong>Cliquez ici</strong> ou glissez-déposez</p>",
          "<small>Tous formats &middot; Max 20 Mo</small>",
        "</div>",
        "<div id='plFileInfo'></div>",
        "<label class='pl-modal-label' style='margin-top:16px;'>Section de destination</label>",
        "<select class='pl-modal-input' id='plLinkSection'>" + sectionOptsHTML + "</select>",
        "<label class='pl-modal-label'>Note (optionnel)</label>",
        "<input class='pl-modal-input' type='text' id='plLinkNote' placeholder='Ex : Mod\u00e8le financier Q1 2025'>",
        "<div id='plModalActions'>",
          "<button class='pl-modal-cancel'>Annuler</button>",
          "<button class='pl-modal-ok' id='plLinkConfirm' disabled>Lier &#x2192;</button>",
        "</div>",
      "</div>"
    ].join("");
    document.body.appendChild(modal);

    var fi = document.createElement("input"); fi.type="file"; fi.style.display="none"; document.body.appendChild(fi);
    var dz=document.getElementById("plDropZone"),inf=document.getElementById("plFileInfo"),cb=document.getElementById("plLinkConfirm");
    function hf(file){if(!file)return;inf.style.color="#526070";inf.textContent="Lecture\u2026";var r=new FileReader();r.onload=function(ev){selectedFile=file;selectedBase64=ev.target.result.split(",")[1];inf.style.color="#185c38";inf.textContent="\u2713 "+file.name+" ("+Math.round(file.size/1024)+" Ko)";cb.disabled=false;};r.onerror=function(){inf.style.color="#7a1824";inf.textContent="\u26a0 Erreur.";};r.readAsDataURL(file);}
    dz.onclick=function(){fi.click();}; fi.onchange=function(e){if(e.target.files[0])hf(e.target.files[0]);fi.value="";};
    dz.addEventListener("dragover",function(e){e.preventDefault();dz.classList.add("dragover");}); dz.addEventListener("dragleave",function(){dz.classList.remove("dragover");}); dz.addEventListener("drop",function(e){e.preventDefault();dz.classList.remove("dragover");if(e.dataTransfer.files[0])hf(e.dataTransfer.files[0]);});
    function cl(){modal.remove();fi.remove();} modal.querySelector(".pl-modal-cancel").onclick=cl; modal.onclick=function(e){if(e.target===modal)cl();};
    cb.onclick=function(){
      if(!selectedBase64)return;
      var note=document.getElementById("plLinkNote").value||"";
      var section=document.getElementById("plLinkSection").value||"dd";
      /* Récupérer le label lisible pour Make */
      var sectionLabel=section;
      var selEl=document.getElementById("plLinkSection");
      if(selEl&&selEl.selectedOptions&&selEl.selectedOptions[0]) sectionLabel=selEl.selectedOptions[0].text;
      cl();
      plShowToast("Envoi en cours\u2026");
      fetch(WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        deal_id:DEAL_ID,
        source:"link_file",
        file_base64:selectedBase64,
        file_name:selectedFile.name,
        file_type:selectedFile.type,
        section:section,
        section_label:sectionLabel,
        note:note,
        updated_at:new Date().toISOString()
      })}).then(function(r){if(r.ok)plShowToast("\u2713 Li\u00e9 \u2014 rechargez dans 15s.");else plShowToast("Erreur serveur");}).catch(function(){plShowToast("Connexion \u00e9chou\u00e9e");});
    };
  }

  /* INIT UI */
  function init() {
    if (document.getElementById("plEditor")) return;
    var fab = document.createElement("div"); fab.id = "plEditor";
    fab.innerHTML = "<button id='plToggle' onclick='plToggleEdit()'><span id='plIcon'>" + getMainIcon() + "</span><span id='plLabel'>" + getMainLabel() + "</span></button><div id='plActions'><button class='pl-action-btn pl-btn-save' onclick='plSaveChanges()'>&#128190; Sauvegarder &amp; Sync</button><button class='pl-action-btn pl-btn-pdf' onclick='plOpenPDFUpload()'>&#128196; Analyser un document PDF</button><button class='pl-action-btn pl-btn-link' onclick='plAttachLink()'>&#128279; Lier un fichier (sans analyse)</button><button class='pl-action-btn pl-btn-section' onclick='plAddSection()'>+ Ajouter une section manuellement</button><button class='pl-action-btn pl-btn-cancel' onclick='plCancelEdit()'>&#x2715; Annuler</button></div><div id='plToast'></div>";
    document.body.appendChild(fab);
    initAutoLightbox();
    initLightboxHandlers();
    hideEmptySynergies();
  }

  /* ═══════════════════════════════════════════════════════════════
     LIGHTBOX — PURE JS SHOW/HIDE (v3.5)
  ═══════════════════════════════════════════════════════════════ */
  function initAutoLightbox() {
    document.querySelectorAll('.sticky-img').forEach(function(img, i) {
      if (img.closest('.zoom-trigger') || img.closest('.img-lightbox')) return;
      var id = 'lb-auto-' + i;
      var overlay = document.createElement('div');
      overlay.className = 'img-lightbox'; overlay.id = id;
      overlay.style.display = 'none';
      overlay.innerHTML = '<a href="#" class="lb-close">&times;</a><img src="' + img.src + '" alt="' + (img.alt || '') + '">';
      document.body.appendChild(overlay);
      var trigger = document.createElement('a');
      trigger.href = '#' + id; trigger.className = 'zoom-trigger';
      img.parentNode.insertBefore(trigger, img); trigger.appendChild(img);
    });
  }

  function initLightboxHandlers() {
    document.querySelectorAll('a.zoom-trigger').forEach(function(trigger) {
      if (trigger.dataset.plLbReady) return;
      trigger.dataset.plLbReady = '1';
      trigger.addEventListener('click', function(e) {
        var href = trigger.getAttribute('href') || '';
        if (!href.startsWith('#')) return;
        var lb = document.getElementById(href.slice(1));
        if (!lb || !lb.classList.contains('img-lightbox')) return;
        e.preventDefault();
        lb.style.display = 'flex';
      });
    });
    document.addEventListener('click', function(e) {
      var btn = e.target.closest && e.target.closest('.lb-close');
      if (btn) {
        e.preventDefault();
        var savedY = window.scrollY;
        var lb = btn.closest('.img-lightbox');
        if (lb) lb.style.display = 'none';
        if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
        window.scrollTo(0, savedY); return;
      }
      if (e.target.classList && e.target.classList.contains('img-lightbox')) {
        var savedY = window.scrollY;
        e.target.style.display = 'none';
        if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
        window.scrollTo(0, savedY);
      }
    });
  }

  /* HIDE EMPTY SYNERGIES */
  function hideEmptySynergies() {
    var section = document.getElementById('synergies-custom'); if (!section) return;
    var title = section.querySelector('.section-title'); if (!title) return;
    var text = (title.textContent || title.innerText || '').trim();
    var isEmpty = /\band\s*$|\bet\s*$|\bund\s*$|\by\s*$|\be\s*$/i.test(text) || /undefined|null|\{\{/i.test(text) || text.replace(/[^a-z]/gi,'').length < 5;
    if (!isEmpty) return;
    section.style.display = 'none';
    var navLink = document.querySelector('a[href="#synergies-custom"]'); if (navLink) navLink.style.display = 'none';
    document.querySelectorAll('.sb-nav-heading').forEach(function(h) {
      var next = h.nextElementSibling;
      if (next && next.getAttribute('href') === '#synergies-custom' && next.style.display === 'none') h.style.display = 'none';
    });
  }

  /* EDITOR ACTIONS */
  window.plToggleEdit = function() {
    editMode = !editMode;
    if (editMode) {
      var editorEl = document.getElementById("plEditor"), editorParent = editorEl ? editorEl.parentNode : null;
      if (editorEl && editorParent) editorEl.remove();
      savedHTML = document.documentElement.outerHTML;
      if (editorEl && editorParent) editorParent.appendChild(editorEl);
      plEnableEditing();
    } else { plCancelEdit(); }
  };
  window.plOpenPDFUpload = function() { showPDFModal(); };
  window.plAttachLink    = function() { showLinkFileModal(); };

  function plEnableEditing() {
    document.getElementById("plToggle").classList.add("editing");
    document.getElementById("plLabel").textContent = " En cours d'\u00e9dition\u2026";
    document.getElementById("plActions").style.display = "flex";
    document.body.classList.add("pl-editing");
    var sel = ".content-area p,.content-area h1,.content-area h2,.content-area h3,.content-area h4,.content-area li,.content-area td,.content-area b,.content-area span.text-block,.content-area div.text-block";
    document.querySelectorAll(sel).forEach(function(el) { if (!el.closest("#plEditor") && !el.closest("#plModal")) { el.setAttribute("contenteditable","true"); el.style.cursor="text"; } });
    document.querySelectorAll(".section-container").forEach(function(sec) {
      if (sec.querySelector(".pl-section-ctrl")) return;
      var title = sec.querySelector(".section-title"), name = title ? title.textContent.trim().slice(0,36) : "Section";
      var ctrl = document.createElement("div"); ctrl.className = "pl-section-ctrl";
      ctrl.innerHTML = "<button class='pl-ctrl-btn pl-hide-btn' data-hidden='false' onclick='plToggleSection(this)'>&#128065; Masquer</button><button class='pl-ctrl-btn pl-del-btn' onclick='plDeleteSection(this)'>&#x2715; Supprimer</button><span class='pl-ctrl-btn pl-label-btn'>" + name + "</span>";
      sec.insertBefore(ctrl, sec.firstChild);
    });
  }

  window.plToggleSection = function(btn) {
    var sec = btn.closest(".section-container"), hidden = btn.dataset.hidden === "true";
    Array.from(sec.children).forEach(function(c) { if (!c.classList.contains("pl-section-ctrl")) { c.style.opacity = hidden ? "1" : "0.1"; c.style.pointerEvents = hidden ? "" : "none"; } });
    btn.dataset.hidden = hidden ? "false" : "true"; btn.textContent = hidden ? "\ud83d\udc41 Masquer" : "\ud83d\udeab Masqu\u00e9"; btn.style.background = hidden ? "" : "#0f1f33"; btn.style.color = hidden ? "" : "#fff";
  };

  window.plDeleteSection = function(btn) {
    var sec = btn.closest(".section-container"), t = sec.querySelector(".section-title");
    showModal({ title: "Supprimer \u201c" + (t ? t.textContent.trim() : "cette section") + "\u201d ?", fields: [] }, function() { sec.remove(); plShowToast("Section supprim\u00e9e"); });
  };

  /* AJOUTER UNE SECTION — v3.6: champ "Insérer" dynamique */
  window.plAddSection = function() {
    /* Construire la liste des positions disponibles depuis le DOM */
    var sectionOpts = buildSectionOptions();
    var positionOptions = [{ value: "__end__", label: "Fin du document" }].concat(
      sectionOpts.map(function(o) { return { value: o.value, label: "Après : " + o.label.slice(0,40) }; })
    );

    showModal({
      title: "Ajouter une section",
      fields: [
        { key: "type", label: "Type de section", type: "select", options: [
          { value: "text",  label: "Texte libre" },
          { value: "table", label: "Tableau financier" },
          { value: "flags", label: "Risk flags & signaux" }
        ]},
        { key: "title",    label: "Titre",   placeholder: "Ex : Notes de Due Diligence" },
        { key: "position", label: "Ins\u00e9rer", type: "select", options: positionOptions }
      ]
    }, function(res) {
      if (!res.type) return;
      var sec = document.createElement("div"); sec.className = "section-container";
      if (res.type === "text") {
        sec.innerHTML = "<h2 class='section-title' contenteditable='true'>" + (res.title || "Nouvelle Section") + "</h2><p class='text-block' contenteditable='true' style='line-height:1.75;'>R\u00e9digez votre contenu ici\u2026</p>";

      } else if (res.type === "table") {
        /* Tableau avec boutons + ligne / + colonne */
        sec.innerHTML = [
          "<h2 class='section-title' contenteditable='true'>" + (res.title || "Tableau") + "</h2>",
          "<div class='pl-table-wrap' style='overflow-x:auto;position:relative;'>",
            "<table class='pl-custom-table' style='width:100%;border-collapse:collapse;font-size:0.95rem;'>",
              "<thead>",
                "<tr style='background:#0f1f33;'>",
                  "<th contenteditable='true' style='padding:10px 12px;text-align:left;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.1);min-width:120px;'>Métrique</th>",
                  "<th contenteditable='true' style='padding:10px 12px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;border-right:1px solid rgba(255,255,255,0.1);min-width:80px;'>Y1</th>",
                  "<th contenteditable='true' style='padding:10px 12px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;border-right:1px solid rgba(255,255,255,0.1);min-width:80px;'>Y2</th>",
                  "<th contenteditable='true' style='padding:10px 12px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;min-width:80px;'>Y3</th>",
                  /* Bouton + colonne dans le header */
                  "<th style='padding:4px;background:#1e3553;width:32px;'>",
                    "<button onclick='plTableAddCol(this)' title='Ajouter une colonne' style='background:#2d4a6e;color:#fff;border:none;width:24px;height:24px;cursor:pointer;font-size:14px;border-radius:2px;line-height:1;'>+</button>",
                  "</th>",
                "</tr>",
              "</thead>",
              "<tbody>",
                "<tr>",
                  "<td contenteditable='true' style='padding:10px 12px;border-bottom:1px solid #e4e7ed;border-right:1px solid #e4e7ed;font-weight:600;'>Revenu (M€)</td>",
                  "<td contenteditable='true' style='padding:10px 12px;border-bottom:1px solid #e4e7ed;border-right:1px solid #e4e7ed;font-family:DM Mono,monospace;text-align:right;'>—</td>",
                  "<td contenteditable='true' style='padding:10px 12px;border-bottom:1px solid #e4e7ed;border-right:1px solid #e4e7ed;font-family:DM Mono,monospace;text-align:right;'>—</td>",
                  "<td contenteditable='true' style='padding:10px 12px;border-bottom:1px solid #e4e7ed;font-family:DM Mono,monospace;text-align:right;'>—</td>",
                  /* Cellule vide sous le bouton + col */
                  "<td style='border-bottom:1px solid #e4e7ed;width:32px;'></td>",
                "</tr>",
              "</tbody>",
            "</table>",
            /* Bouton + ligne sous le tableau */
            "<button onclick='plTableAddRow(this)' title='Ajouter une ligne' style='margin-top:6px;background:#f0f2f5;border:1px dashed #c0ccd8;color:#526070;padding:5px 14px;font-family:DM Mono,monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;width:100%;'>+ Ligne</button>",
          "</div>"
        ].join("");

      } else if (res.type === "flags") {
        /* Fix : pas d'italic sur les flags */
        sec.innerHTML = [
          "<h2 class='section-title' contenteditable='true'>" + (res.title || "Risk Flags") + "</h2>",
          "<div style='background:#faf0f1;border-left:3px solid #7a1824;padding:12px 15px;font-size:0.92rem;color:#7a1824;margin-bottom:8px;' contenteditable='true'>\u26a0 Nouveau risk flag</div>",
          "<div style='background:#f0faf5;border-left:3px solid #185c38;padding:12px 15px;font-size:0.92rem;color:#185c38;margin-bottom:8px;' contenteditable='true'>\u2705 Signal positif</div>",
          "<button onclick='plFlagsAddRow(this,\"red\")' style='background:#f0f2f5;border:1px dashed #ddb8be;color:#7a1824;padding:5px 14px;font-family:DM Mono,monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;margin-right:6px;'>+ Risk flag</button>",
          "<button onclick='plFlagsAddRow(this,\"green\")' style='background:#f0f2f5;border:1px dashed #b0d4c0;color:#185c38;padding:5px 14px;font-family:DM Mono,monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;'>+ Signal positif</button>"
        ].join("");
      }

      /* Insertion à la position choisie */
      var inserted = false;
      if (res.position && res.position !== "__end__") {
        var target = document.getElementById(res.position) ||
                     document.querySelector("[data-pl-id='" + res.position + "']");
        if (target && target.classList.contains("section-container")) {
          target.insertAdjacentElement("afterend", sec);
          inserted = true;
        }
      }
      if (!inserted) document.querySelector(".content-area").appendChild(sec);

      /* Ajouter les contrôles d'édition immédiatement */
      var ctrl = document.createElement("div"); ctrl.className = "pl-section-ctrl";
      var titleEl = sec.querySelector(".section-title");
      var name = titleEl ? titleEl.textContent.trim().slice(0,36) : "Section";
      ctrl.innerHTML = "<button class='pl-ctrl-btn pl-hide-btn' data-hidden='false' onclick='plToggleSection(this)'>&#128065; Masquer</button><button class='pl-ctrl-btn pl-del-btn' onclick='plDeleteSection(this)'>&#x2715; Supprimer</button><span class='pl-ctrl-btn pl-label-btn'>" + name + "</span>";
      sec.insertBefore(ctrl, sec.firstChild);

      plShowToast("Section ajout\u00e9e");
      setTimeout(function() { sec.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
    });
  };

  /* ── HELPERS TABLEAU DYNAMIQUE ── */

  /* Ajouter une ligne */
  window.plTableAddRow = function(btn) {
    var table = btn.parentNode.querySelector("table");
    if (!table) return;
    var tbody = table.querySelector("tbody");
    if (!tbody) return;
    /* Compter les colonnes depuis le header */
    var headerCells = table.querySelectorAll("thead tr th");
    /* -1 pour ignorer la cellule du bouton +col */
    var colCount = Math.max(headerCells.length - 1, 1);
    var tr = document.createElement("tr");
    for (var i = 0; i < colCount; i++) {
      var td = document.createElement("td");
      td.contentEditable = "true";
      td.style.cssText = "padding:10px 12px;border-bottom:1px solid #e4e7ed;" +
        (i === colCount - 1 ? "" : "border-right:1px solid #e4e7ed;") +
        (i === 0 ? "font-weight:600;" : "font-family:DM Mono,monospace;text-align:right;");
      td.textContent = i === 0 ? "Nouvelle ligne" : "—";
      tr.appendChild(td);
    }
    /* Cellule vide sous le bouton +col */
    var tdEmpty = document.createElement("td");
    tdEmpty.style.cssText = "border-bottom:1px solid #e4e7ed;width:32px;";
    tr.appendChild(tdEmpty);
    tbody.appendChild(tr);
    /* Focus sur la première cellule */
    var first = tr.querySelector("td");
    if (first) { first.focus(); var r=document.createRange();r.selectNodeContents(first);r.collapse(false);var s=window.getSelection();s.removeAllRanges();s.addRange(r); }
  };

  /* Ajouter une colonne */
  window.plTableAddCol = function(btn) {
    var table = btn.closest("table");
    if (!table) return;
    var headerRow = table.querySelector("thead tr");
    if (!headerRow) return;
    /* Insérer un nouveau th AVANT le th du bouton +col */
    var addColTh = btn.closest("th");
    var newTh = document.createElement("th");
    newTh.contentEditable = "true";
    newTh.style.cssText = "padding:10px 12px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;border-right:1px solid rgba(255,255,255,0.1);min-width:80px;";
    newTh.textContent = "Col";
    headerRow.insertBefore(newTh, addColTh);
    /* Ajouter une cellule dans chaque ligne du tbody */
    var rows = table.querySelectorAll("tbody tr");
    rows.forEach(function(row) {
      var cells = row.querySelectorAll("td");
      /* La dernière cellule est toujours la cellule vide (sous +col) */
      var lastEmpty = cells[cells.length - 1];
      var newTd = document.createElement("td");
      newTd.contentEditable = "true";
      newTd.style.cssText = "padding:10px 12px;border-bottom:1px solid #e4e7ed;border-right:1px solid #e4e7ed;font-family:DM Mono,monospace;text-align:right;";
      newTd.textContent = "—";
      row.insertBefore(newTd, lastEmpty);
    });
    newTh.focus();
  };

  /* Ajouter un flag ou signal */
  window.plFlagsAddRow = function(btn, type) {
    var isRed = type === "red";
    var div = document.createElement("div");
    div.contentEditable = "true";
    div.style.cssText = "background:" + (isRed ? "#faf0f1" : "#f0faf5") + ";border-left:3px solid " + (isRed ? "#7a1824" : "#185c38") + ";padding:12px 15px;font-size:0.92rem;color:" + (isRed ? "#7a1824" : "#185c38") + ";margin-bottom:8px;";
    div.textContent = isRed ? "\u26a0 Nouveau risk flag" : "\u2705 Signal positif";
    /* Insérer avant les boutons */
    btn.parentNode.insertBefore(div, btn);
    div.focus();
    var r=document.createRange();r.selectNodeContents(div);r.collapse(false);var s=window.getSelection();s.removeAllRanges();s.addRange(r);
  };

  window.plSaveChanges = function() {
    plShowToast("Sauvegarde en cours\u2026");
    var clone = document.documentElement.cloneNode(true);
    ["#plEditor","#plToast","#plModal"].forEach(function(s){var el=clone.querySelector(s);if(el)el.remove();});
    clone.querySelectorAll(".pl-section-ctrl").forEach(function(el){el.remove();});
    /* Retirer les boutons +Ligne / +Col / +Flag avant de sauvegarder */
    clone.querySelectorAll("button[onclick^='plTableAdd'], button[onclick^='plFlagsAdd']").forEach(function(el){el.remove();});
    /* Retirer la colonne fantôme du bouton +col (th/td vide en fin de ligne) */
    clone.querySelectorAll("table.pl-custom-table thead tr th:last-child").forEach(function(th){
      if (th.querySelector("button[onclick^='plTableAddCol']") || th.style.width === "32px") th.remove();
    });
    clone.querySelectorAll("table.pl-custom-table tbody tr td:last-child").forEach(function(td){
      if (td.style.width === "32px" && !td.textContent.trim()) td.remove();
    });
    clone.querySelectorAll("[contenteditable]").forEach(function(el){
      el.removeAttribute("contenteditable");
      el.style.cursor  = "";
      el.style.outline = "";
      /* Préserver les background inline des td/th (vert hurdle, jaune assumptions…).
         On ne retire que le rgba semi-transparent injecté par l'éditeur. */
      var bg = el.style.background || el.style.backgroundColor || "";
      if (/rgba\(143,\s*168,\s*200/i.test(bg) || /rgba\(254,\s*249,\s*195/i.test(bg)) {
        el.style.background = "";
      }
    });
    if(clone.body)clone.body.classList.remove("pl-editing");
    var html="<!DOCTYPE html>\n"+clone.outerHTML;
    fetch(WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deal_id:DEAL_ID,updated_html:html,updated_at:new Date().toISOString(),source:"live_editor"})})
      .then(function(r){if(r.ok){plShowToast("\u2713 Sauvegard\u00e9 et synchronis\u00e9");plExitEditMode();}else{plShowToast("Erreur serveur");}})
      .catch(function(){plShowToast("Connexion \u00e9chou\u00e9e");});
  };

  window.plCancelEdit = function() {
    if (savedHTML) {
      try {
        var parser=new DOMParser(),savedDoc=parser.parseFromString(savedHTML,"text/html");
        var sc=savedDoc.querySelector(".content-area"),cc=document.querySelector(".content-area");
        if(sc&&cc)cc.innerHTML=sc.innerHTML;
      } catch(e){}
    }
    plExitEditMode(); savedHTML="";
  };

  function plExitEditMode() {
    editMode=false; document.body.classList.remove("pl-editing");
    var toggle=document.getElementById("plToggle"); if(toggle)toggle.classList.remove("editing");
    var icon=document.getElementById("plIcon"); if(icon)icon.innerHTML=getMainIcon();
    var lbl=document.getElementById("plLabel");  if(lbl)lbl.textContent=getMainLabel();
    var acts=document.getElementById("plActions"); if(acts)acts.style.display="none";
    document.querySelectorAll("[contenteditable]").forEach(function(el){
      if(!el.closest("#plEditor")){
        el.removeAttribute("contenteditable");
        el.style.cursor  = "";
        el.style.outline = "";
        var bg = el.style.background || el.style.backgroundColor || "";
        if (/rgba\(143,\s*168,\s*200/i.test(bg) || /rgba\(254,\s*249,\s*195/i.test(bg)) {
          el.style.background = "";
        }
      }
    });
    document.querySelectorAll(".pl-section-ctrl").forEach(function(el){el.remove();});
  }

  function plShowToast(msg) {
    var t=document.getElementById("plToast"); if(!t)return;
    t.textContent=msg; t.style.opacity="1";
    clearTimeout(window._plTimer);
    window._plTimer=setTimeout(function(){t.style.opacity="0";},4500);
  }

  if (document.readyState==='loading') { document.addEventListener('DOMContentLoaded',init); } else { init(); }
})();
