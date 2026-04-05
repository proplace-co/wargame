/* PROPLACE LIVE EDITOR - v3.6
   Base : v3.5 (lightbox JS, double pen fix, auto-lightbox, hide empty synergies)
   v3.6 adds:
   - PDF upload via PDF.co pre-upload (data-pdfco-key) — taille illimitée
   - "Ajouter une section" : champ "Insérer" dynamique (position dans le mémo)
   - "Lier un fichier" : liste toutes les sections du mémo
   - Tableau dynamique avec +Ligne / +Colonne
   - Risk flags sans italic + boutons +Flag / +Signal
   - Fix backgrounds inline tableaux préservés au save
*/
(function() {
  'use strict';

  var currentScript = document.currentScript || (function() {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();
  var WEBHOOK_URL  = currentScript.getAttribute("data-webhook")      || "";
  var DEAL_ID      = currentScript.getAttribute("data-deal")         || "";
  var STATUS       = (currentScript.getAttribute("data-status") || "NEW").toUpperCase();
  var PDFCO_KEY    = currentScript.getAttribute("data-pdfco-key")    || "";
  var GH_TOKEN     = currentScript.getAttribute("data-github-token") || "";
  var GH_REPO      = currentScript.getAttribute("data-github-repo")  || "";
  var GH_FILE      = currentScript.getAttribute("data-github-file")  || "";
  var editMode     = false;
  var savedHTML    = "";

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

  /* MODAL PDF UPLOAD — circuit PDF.co si clé présente, sinon base64 direct */
  function showPDFModal() {
    if (!WEBHOOK_URL) { alert("⚠️ data-webhook manquant sur la balise <script>."); return; }
    var existing = document.getElementById("plModal"); if (existing) existing.remove();
    var selectedFile = null, selectedBase64 = null;
    var hasPdfco = !!PDFCO_KEY;
    var sizeHint = hasPdfco ? "PDF uniquement &middot; Taille illimitée" : "PDF uniquement &middot; Max 3 Mo";
    var LIMIT = 3 * 1024 * 1024;

    var modal = document.createElement("div"); modal.id = "plModal";
    modal.innerHTML = "<div id='plModalBox'><h2 id='plModalTitle'>&#128196; Analyser un document PDF</h2><p id='plModalSubtitle'>Stan va analyser le PDF et mettre à jour la section Due Diligence ou Portfolio.</p><div id='plDropZone'><p>&#128196; <strong>Cliquez ici</strong> ou glissez-déposez</p><small>" + sizeHint + "</small></div><div id='plFileInfo'></div><label class='pl-modal-label' style='margin-top:16px;'>Note (optionnel)</label><input class='pl-modal-input' type='text' id='plPdfNote' placeholder='Ex : Term sheet Partech v finale'><div id='plModalActions'><button class='pl-modal-cancel'>Annuler</button><button class='pl-modal-ok' id='plPdfConfirm' disabled>Envoyer &#x2192;</button></div></div>";
    document.body.appendChild(modal);

    var fi = document.createElement("input"); fi.type="file"; fi.accept=".pdf,application/pdf"; fi.style.display="none"; document.body.appendChild(fi);
    var dz=document.getElementById("plDropZone"), inf=document.getElementById("plFileInfo"), cb=document.getElementById("plPdfConfirm");

    function hf(file) {
      if (!file || file.type !== "application/pdf") { inf.style.color="#7a1824"; inf.textContent="\u26a0 PDF uniquement."; return; }
      if (!hasPdfco && file.size > LIMIT) {
        inf.style.color="#7a1824"; inf.textContent="\u26a0 " + Math.round(file.size/1024) + " Ko \u2014 max 3 Mo. Ajoutez data-pdfco-key ou compressez.";
        cb.disabled=true; selectedFile=null; selectedBase64=null; return;
      }
      inf.style.color="#526070"; inf.textContent="Lecture\u2026";
      var r = new FileReader();
      r.onload=function(ev){ selectedFile=file; selectedBase64=ev.target.result.split(",")[1]; inf.style.color="#185c38"; inf.textContent="\u2713 "+file.name+" ("+Math.round(file.size/1024)+" Ko)"+(hasPdfco?" \u2014 via PDF.co":""); cb.disabled=false; };
      r.onerror=function(){ inf.style.color="#7a1824"; inf.textContent="\u26a0 Erreur de lecture."; };
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

      if (hasPdfco) {
        /* Circuit PDF.co : upload d'abord, puis envoie l'URL à Make */
        plShowToast("Upload PDF en cours\u2026");
        fetch("https://api.pdf.co/v1/file/upload/base64", {
          method:"POST",
          headers:{"Content-Type":"application/json","x-api-key":PDFCO_KEY},
          body:JSON.stringify({name:selectedFile.name,file:selectedBase64})
        })
        .then(function(r){return r.json();})
        .then(function(data){
          if(!data.url){plShowToast("\u26a0 PDF.co \u00e9chou\u00e9 : "+(data.message||"erreur"));return Promise.resolve();}
          plShowToast("Analyse en cours\u2026 (30-60s)");
          return fetch(WEBHOOK_URL,{
            method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({deal_id:DEAL_ID,source:"document_upload",file_url:data.url,file_name:selectedFile.name,file_type:selectedFile.type,note:note,updated_at:new Date().toISOString()})
          });
        })
        .then(function(r){if(r&&r.ok)plShowToast("\u2713 Re\u00e7u \u2014 rechargez dans 60s.");else if(r)plShowToast("Erreur serveur ("+r.status+")");})
        .catch(function(){plShowToast(!navigator.onLine?"\u26a0 Pas de connexion":"\u26a0 \u00c9chou\u00e9 \u2014 v\u00e9rifiez cl\u00e9 PDF.co");});

      } else {
        /* Circuit fallback : base64 direct */
        plShowToast("Envoi en cours\u2026");
        fetch(WEBHOOK_URL,{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({deal_id:DEAL_ID,source:"document_upload",file_base64:selectedBase64,file_name:selectedFile.name,file_type:selectedFile.type,note:note,updated_at:new Date().toISOString()})
        })
        .then(function(r){if(r.ok)plShowToast("\u2713 Re\u00e7u \u2014 rechargez dans 60s.");else plShowToast("Erreur serveur ("+r.status+")");})
        .catch(function(){plShowToast(!navigator.onLine?"\u26a0 Pas de connexion":"\u26a0 \u00c9chou\u00e9 \u2014 sc\u00e9nario Make actif ?");});
      }
    };
  }

  /* MODAL LIER UN FICHIER — toujours via PDF.co (file_url), taille illimitée */
  function showLinkFileModal() {
    var existing = document.getElementById("plModal"); if (existing) existing.remove();
    var selectedFile=null, selectedBase64=null;
    var sectionOpts = buildSectionOptions();
    var sectionOptsHTML = sectionOpts.length
      ? sectionOpts.map(function(o){return "<option value='"+o.value+"'>"+o.label+"</option>";}).join("")
      : "<option value='dd'>Due Diligence</option><option value='pm'>Portfolio Company</option>";

    if (!PDFCO_KEY) {
      alert("\u26a0 data-pdfco-key manquant sur la balise <script>. Ajoutez votre cl\u00e9 PDF.co pour activer cette fonctionnalit\u00e9.");
      return;
    }

    var modal = document.createElement("div"); modal.id="plModal";
    modal.innerHTML = "<div id='plModalBox'><h2 id='plModalTitle'>&#128279; Lier un fichier (sans analyse)</h2><p id='plModalSubtitle'>Le fichier sera <strong>sauvegardé dans Drive</strong> et un lien sera ajouté dans la section choisie. <strong>Aucune analyse IA &middot; Taille illimitée.</strong></p><div id='plDropZone'><p>&#128194; <strong>Cliquez ici</strong> ou glissez-déposez</p><small>Tous formats &middot; Taille illimitée</small></div><div id='plFileInfo'></div><label class='pl-modal-label' style='margin-top:16px;'>Section de destination</label><select class='pl-modal-input' id='plLinkSection'>"+sectionOptsHTML+"</select><label class='pl-modal-label'>Note (optionnel)</label><input class='pl-modal-input' type='text' id='plLinkNote' placeholder='Ex : Modèle financier Q1 2025'><div id='plModalActions'><button class='pl-modal-cancel'>Annuler</button><button class='pl-modal-ok' id='plLinkConfirm' disabled>Lier &#x2192;</button></div></div>";
    document.body.appendChild(modal);

    var fi=document.createElement("input"); fi.type="file"; fi.style.display="none"; document.body.appendChild(fi);
    var dz=document.getElementById("plDropZone"),inf=document.getElementById("plFileInfo"),cb=document.getElementById("plLinkConfirm");

    function hf(file){
      if(!file)return;
      inf.style.color="#526070"; inf.textContent="Lecture\u2026";
      var r=new FileReader();
      r.onload=function(ev){
        selectedFile=file; selectedBase64=ev.target.result.split(",")[1];
        inf.style.color="#185c38";
        inf.textContent="\u2713 "+file.name+" ("+Math.round(file.size/1024)+" Ko) \u2014 via PDF.co";
        cb.disabled=false;
      };
      r.onerror=function(){inf.style.color="#7a1824";inf.textContent="\u26a0 Erreur.";};
      r.readAsDataURL(file);
    }

    dz.onclick=function(){fi.click();}; fi.onchange=function(e){if(e.target.files[0])hf(e.target.files[0]);fi.value="";};
    dz.addEventListener("dragover",function(e){e.preventDefault();dz.classList.add("dragover");}); dz.addEventListener("dragleave",function(){dz.classList.remove("dragover");}); dz.addEventListener("drop",function(e){e.preventDefault();dz.classList.remove("dragover");if(e.dataTransfer.files[0])hf(e.dataTransfer.files[0]);});
    function cl(){modal.remove();fi.remove();} modal.querySelector(".pl-modal-cancel").onclick=cl; modal.onclick=function(e){if(e.target===modal)cl();};

    cb.onclick=function(){
      if(!selectedBase64||!selectedFile)return;
      var note=document.getElementById("plLinkNote").value||"";
      var selEl=document.getElementById("plLinkSection");
      var section=selEl?selEl.value:"dd";
      var sectionLabel=selEl&&selEl.selectedOptions&&selEl.selectedOptions[0]?selEl.selectedOptions[0].text:section;
      var fileName=selectedFile.name;
      cl();

      /* Upload vers PDF.co → injecte la carte immédiatement → sauvegarde HTML */
      plShowToast("Upload en cours\u2026");
      fetch("https://api.pdf.co/v1/file/upload/base64",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":PDFCO_KEY},
        body:JSON.stringify({name:fileName, file:selectedBase64})
      })
      .then(function(r){return r.json();})
      .then(function(data){
        if(!data.url){plShowToast("\u26a0 PDF.co \u00e9chou\u00e9 : "+(data.message||"erreur"));return;}

        /* 1 — Injecter la carte dans la section cible */
        plInjectFileCard(data.url, fileName, sectionLabel, note, section);

        /* 2 — Sauvegarder le HTML immédiatement sur GitHub */
        plShowToast("Sauvegarde en cours\u2026");
        plSaveHTMLNow(function(ok){
          if(ok) plShowToast("\u2713 Fichier li\u00e9 et m\u00e9mo mis \u00e0 jour !");
          else   plShowToast("\u2713 Carte ajout\u00e9e \u2014 \u00e9chec sync GitHub");
        });

        /* 3 — Envoyer aussi à Make pour Drive storage (async, pas bloquant) */
        fetch(WEBHOOK_URL,{
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            deal_id:      DEAL_ID,
            source:       "link_file",
            file_url:     data.url,
            file_name:    fileName,
            file_type:    selectedFile.type,
            section:      section,
            section_label:sectionLabel,
            note:         note,
            updated_at:   new Date().toISOString()
          })
        }).catch(function(){/* silencieux */});
      })
      .catch(function(){plShowToast(!navigator.onLine?"\u26a0 Pas de connexion":"\u26a0 \u00c9chou\u00e9 \u2014 v\u00e9rifiez cl\u00e9 PDF.co");});
    };
  }

  /* Injecte une carte fichier dans la section cible du mémo */
  function plInjectFileCard(fileUrl, fileName, sectionLabel, note, sectionId) {
    var ext = fileName.split('.').pop().toUpperCase();
    var date = new Date().toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'});
    var card = document.createElement("div");
    card.className = "pl-linked-file";
    card.style.cssText = "display:flex;align-items:center;gap:12px;padding:11px 14px;background:#f4f5f7;border:1px solid #d4d9e2;border-left:3px solid #0f1f33;margin-bottom:8px;";
    card.innerHTML = [
      "<span style='font-family:DM Mono,monospace;font-size:0.62rem;background:#0f1f33;color:#fff;padding:2px 7px;letter-spacing:0.06em;flex-shrink:0;'>"+ext+"</span>",
      "<div style='flex:1;min-width:0;'>",
        "<a href='"+fileUrl+"' target='_blank' style='font-family:EB Garamond,serif;font-size:0.95rem;font-weight:600;color:#0f1f33;text-decoration:underline;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'>"+fileName+"</a>",
        "<span style='font-family:DM Mono,monospace;font-size:0.6rem;color:#9eaaba;letter-spacing:0.04em;'>"+date+(note?" &middot; "+note:"")+"</span>",
      "</div>"
    ].join("");

    /* Trouver la section cible */
    var target = document.getElementById(sectionId) ||
                 document.querySelector("[data-pl-id='"+sectionId+"']") ||
                 document.getElementById(sectionId.toLowerCase().replace(/\s+/g,"-")) ||
                 document.getElementById("due-diligence") ||
                 document.querySelector(".section-container");

    if (target) {
      /* Insérer après le section-title */
      var title = target.querySelector(".section-title");
      if (title && title.nextSibling) {
        target.insertBefore(card, title.nextSibling);
      } else {
        target.appendChild(card);
      }
      card.scrollIntoView({behavior:"smooth", block:"center"});
    }
  }

  /* Sauvegarde le HTML courant sur GitHub via le webhook live_editor */
  function plSaveHTMLNow(callback) {
    var editorEl = document.getElementById("plEditor");
    var ep = editorEl ? editorEl.parentNode : null;
    if (editorEl && ep) editorEl.remove();
    var clone = document.documentElement.cloneNode(true);
    if (editorEl && ep) ep.appendChild(editorEl);

    /* Nettoyer les éléments éditeur */
    ["#plEditor","#plToast","#plModal"].forEach(function(s){var el=clone.querySelector(s);if(el)el.remove();});
    clone.querySelectorAll(".pl-section-ctrl").forEach(function(el){el.remove();});
    clone.querySelectorAll("[contenteditable]").forEach(function(el){
      el.removeAttribute("contenteditable"); el.style.cursor=""; el.style.outline="";
    });
    var html = "<!DOCTYPE html>\n" + clone.outerHTML;

    fetch(WEBHOOK_URL,{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        deal_id:     DEAL_ID,
        source:      "live_editor",
        updated_html:html,
        updated_at:  new Date().toISOString()
      })
    })
    .then(function(r){ callback(r.ok); })
    .catch(function(){ callback(false); });
  }

  /* INIT UI */
  function init() {
    if (document.getElementById("plEditor")) return;
    var fab=document.createElement("div"); fab.id="plEditor";
    fab.innerHTML=[
      "<button id='plToggle' onclick='plToggleEdit()'>",
        "<span id='plIcon'>"+getMainIcon()+"</span>",
        "<span id='plLabel'>"+getMainLabel()+"</span>",
      "</button>",
      /* Phase 1 : actions immédiates (PDF/Link/Section) — pas de Save */
      "<div id='plActionsP1' style='display:none;flex-direction:column;gap:6px;align-items:flex-end;'>",
        "<button class='pl-action-btn pl-btn-pdf'     onclick='plOpenPDFUpload()'>&#128196; Analyser un document PDF</button>",
        "<button class='pl-action-btn pl-btn-link'    onclick='plAttachLink()'>&#128279; Lier un fichier (sans analyse)</button>",
        "<button class='pl-action-btn pl-btn-section' onclick='plAddSection()'>+ Ajouter une section manuellement</button>",
        "<button class='pl-action-btn' style='background:#526070;color:#fff;' onclick='plStartTextEdit()'>&#9998; Éditer le texte du mémo</button>",
        "<button class='pl-action-btn pl-btn-cancel'  onclick='plCloseActions()'>&#x2715; Fermer</button>",
      "</div>",
      /* Phase 2 : après ajout section ou édition texte — Save visible */
      "<div id='plActionsP2' style='display:none;flex-direction:column;gap:6px;align-items:flex-end;'>",
        "<button class='pl-action-btn pl-btn-save'   onclick='plSaveChanges()'>&#128190; Sauvegarder &amp; Sync</button>",
        "<button class='pl-action-btn pl-btn-cancel' onclick='plCancelEdit()'>&#x2715; Annuler les modifications</button>",
      "</div>",
      "<div id='plToast'></div>"
    ].join("");
    document.body.appendChild(fab);
    initAutoLightbox();
    initLightboxHandlers();
    hideEmptySynergies();
  }

  /* LIGHTBOX */
  function initAutoLightbox() {
    /* 1. Créer des overlays pour les images sans lightbox */
    document.querySelectorAll('.sticky-img').forEach(function(img, i) {
      if (img.closest('.zoom-trigger') || img.closest('.img-lightbox')) return;
      var id = 'lb-auto-' + i;
      var overlay = document.createElement('div');
      overlay.className = 'img-lightbox'; overlay.id = id;
      overlay.innerHTML = '<a href="#" class="lb-close">&times;</a><img src="' + img.src + '" alt="' + (img.alt || '') + '">';
      document.body.appendChild(overlay);
      var trigger = document.createElement('a');
      trigger.href = '#' + id; trigger.className = 'zoom-trigger';
      img.parentNode.insertBefore(trigger, img); trigger.appendChild(img);
    });

    /* 2. Déplacer TOUS les .img-lightbox vers document.body
          (évite que overflow/transform d'un parent piège position:fixed) */
    document.querySelectorAll('.img-lightbox').forEach(function(lb) {
      if (lb.parentNode !== document.body) {
        document.body.appendChild(lb);
      }
      /* Forcer display:none inline sur tous */
      lb.style.display = 'none';
    });
  }
  function initLightboxHandlers() {
    /* Délégation sur document en phase CAPTURE (true) — passe avant tout autre handler.
       setProperty('display','flex','important') écrase même un CSS display:none !important */
    document.addEventListener('click', function(e) {

      /* 1 — Clic sur zoom-trigger ou image à l'intérieur */
      var trigger = e.target.closest && e.target.closest('a.zoom-trigger');
      if (trigger) {
        var href = trigger.getAttribute('href') || '';
        if (href.charAt(0) === '#') {
          var lb = document.getElementById(href.slice(1));
          if (lb && lb.classList.contains('img-lightbox')) {
            e.preventDefault(); e.stopPropagation();
            lb.style.setProperty('display', 'flex', 'important');
            return;
          }
        }
      }

      /* 2 — Clic sur le bouton × */
      var closeBtn = e.target.closest && e.target.closest('.lb-close');
      if (closeBtn) {
        e.preventDefault();
        var sy = window.scrollY;
        var lb2 = closeBtn.closest('.img-lightbox');
        if (lb2) lb2.style.setProperty('display', 'none', 'important');
        if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
        window.scrollTo(0, sy); return;
      }

      /* 3 — Clic sur le fond de l'overlay */
      if (e.target.classList && e.target.classList.contains('img-lightbox')) {
        var sy2 = window.scrollY;
        e.target.style.setProperty('display', 'none', 'important');
        if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
        window.scrollTo(0, sy2);
      }

    }, true); /* true = phase capture */
  }

  /* HIDE EMPTY SYNERGIES */
  function hideEmptySynergies() {
    var section=document.getElementById('synergies-custom'); if(!section)return;
    var title=section.querySelector('.section-title'); if(!title)return;
    var text=(title.textContent||title.innerText||'').trim();
    var isEmpty=/\band\s*$|\bet\s*$|\bund\s*$|\by\s*$|\be\s*$/i.test(text)||/undefined|null|\{\{/i.test(text)||text.replace(/[^a-z]/gi,'').length<5;
    if(!isEmpty)return;
    section.style.display='none';
    var navLink=document.querySelector('a[href="#synergies-custom"]'); if(navLink)navLink.style.display='none';
    document.querySelectorAll('.sb-nav-heading').forEach(function(h){var next=h.nextElementSibling;if(next&&next.getAttribute('href')==='#synergies-custom'&&next.style.display==='none')h.style.display='none';});
  }

  /* EDITOR ACTIONS */
  window.plToggleEdit = function() {
    var p1=document.getElementById("plActionsP1");
    var p2=document.getElementById("plActionsP2");
    if(!editMode && p1.style.display==="none") {
      /* Ouvrir le panneau Phase 1 */
      p1.style.display="flex"; p2.style.display="none";
      document.getElementById("plLabel").textContent=" Options";
    } else {
      /* Fermer tout */
      plCloseActions();
    }
  };

  /* Ferme le panneau sans modifier le contenu */
  window.plCloseActions = function() {
    var p1=document.getElementById("plActionsP1");
    var p2=document.getElementById("plActionsP2");
    if(p1)p1.style.display="none";
    if(p2)p2.style.display="none";
    var icon=document.getElementById("plIcon"); if(icon)icon.innerHTML=getMainIcon();
    var lbl=document.getElementById("plLabel"); if(lbl)lbl.textContent=getMainLabel();
    document.getElementById("plToggle").classList.remove("editing");
  };

  /* Passe en mode édition texte → Phase 2 */
  window.plStartTextEdit = function() {
    var p1=document.getElementById("plActionsP1");
    var p2=document.getElementById("plActionsP2");
    if(p1)p1.style.display="none";
    if(p2)p2.style.display="flex";
    document.getElementById("plToggle").classList.add("editing");
    document.getElementById("plLabel").textContent=" En cours d'\u00e9dition\u2026";
    /* Snapshot avant édition */
    var editorEl=document.getElementById("plEditor"),ep=editorEl?editorEl.parentNode:null;
    if(editorEl&&ep)editorEl.remove();
    savedHTML=document.documentElement.outerHTML;
    if(editorEl&&ep)ep.appendChild(editorEl);
    editMode=true;
    document.body.classList.add("pl-editing");
    plEnableContentEditing();
  };
  window.plOpenPDFUpload = function(){showPDFModal();};
  window.plAttachLink    = function(){showLinkFileModal();};

  /* Active contenteditable sur les éléments texte */
  function plEnableContentEditing() {
    var sel=".content-area p,.content-area h1,.content-area h2,.content-area h3,.content-area h4,.content-area li,.content-area td,.content-area b,.content-area span.text-block,.content-area div.text-block";
    document.querySelectorAll(sel).forEach(function(el){if(!el.closest("#plEditor")&&!el.closest("#plModal")){el.setAttribute("contenteditable","true");el.style.cursor="text";}});
    document.querySelectorAll(".section-container").forEach(function(sec){
      if(sec.querySelector(".pl-section-ctrl"))return;
      var title=sec.querySelector(".section-title"),name=title?title.textContent.trim().slice(0,36):"Section";
      var ctrl=document.createElement("div"); ctrl.className="pl-section-ctrl";
      ctrl.innerHTML="<button class='pl-ctrl-btn pl-hide-btn' data-hidden='false' onclick='plToggleSection(this)'>&#128065; Masquer</button><button class='pl-ctrl-btn pl-del-btn' onclick='plDeleteSection(this)'>&#x2715; Supprimer</button><span class='pl-ctrl-btn pl-label-btn'>"+name+"</span>";
      sec.insertBefore(ctrl,sec.firstChild);
    });
  }

  /* Ancien alias conservé pour compatibilité interne */
  function plEnableEditing() { plEnableContentEditing(); }

  window.plToggleSection = function(btn) {
    var sec=btn.closest(".section-container"),hidden=btn.dataset.hidden==="true";
    Array.from(sec.children).forEach(function(c){if(!c.classList.contains("pl-section-ctrl")){c.style.opacity=hidden?"1":"0.1";c.style.pointerEvents=hidden?"":"none";}});
    btn.dataset.hidden=hidden?"false":"true"; btn.textContent=hidden?"\ud83d\udc41 Masquer":"\ud83d\udeab Masqu\u00e9"; btn.style.background=hidden?"":"#0f1f33"; btn.style.color=hidden?"":"#fff";
  };

  window.plDeleteSection = function(btn) {
    var sec=btn.closest(".section-container"),t=sec.querySelector(".section-title");
    showModal({title:"Supprimer \u201c"+(t?t.textContent.trim():"cette section")+"\u201d ?",fields:[]},function(){sec.remove();plShowToast("Section supprim\u00e9e");});
  };

  /* AJOUTER UNE SECTION */
  window.plAddSection = function() {
    var sectionOpts=buildSectionOptions();
    var positionOptions=[{value:"__end__",label:"Fin du document"}].concat(sectionOpts.map(function(o){return{value:o.value,label:"Après : "+o.label.slice(0,40)};}));
    showModal({
      title:"Ajouter une section",
      fields:[
        {key:"type",label:"Type de section",type:"select",options:[{value:"text",label:"Texte libre"},{value:"table",label:"Tableau financier"},{value:"flags",label:"Risk flags & signaux"}]},
        {key:"title",label:"Titre",placeholder:"Ex : Notes de Due Diligence"},
        {key:"position",label:"Ins\u00e9rer",type:"select",options:positionOptions}
      ]
    },function(res){
      if(!res.type)return;
      var sec=document.createElement("div"); sec.className="section-container";
      if(res.type==="text"){
        sec.innerHTML="<h2 class='section-title' contenteditable='true'>"+(res.title||"Nouvelle Section")+"</h2><p class='text-block' contenteditable='true' style='line-height:1.75;'>R\u00e9digez votre contenu ici\u2026</p>";
      } else if(res.type==="table"){
        sec.innerHTML=[
          "<h2 class='section-title' contenteditable='true'>"+(res.title||"Tableau")+"</h2>",
          "<div class='pl-table-wrap' style='overflow-x:auto;'>",
            "<table class='pl-custom-table' style='width:100%;border-collapse:collapse;font-size:0.95rem;'>",
              "<thead><tr style='background:#0f1f33;'>",
                "<th contenteditable='true' style='padding:10px 12px;text-align:left;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;border-right:1px solid rgba(255,255,255,0.1);min-width:120px;'>Métrique</th>",
                "<th contenteditable='true' style='padding:10px 12px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;border-right:1px solid rgba(255,255,255,0.1);min-width:80px;'>Y1</th>",
                "<th contenteditable='true' style='padding:10px 12px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;border-right:1px solid rgba(255,255,255,0.1);min-width:80px;'>Y2</th>",
                "<th contenteditable='true' style='padding:10px 12px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;min-width:80px;'>Y3</th>",
                "<th style='padding:4px;background:#1e3553;width:32px;'><button onclick='plTableAddCol(this)' style='background:#2d4a6e;color:#fff;border:none;width:24px;height:24px;cursor:pointer;font-size:14px;border-radius:2px;'>+</button></th>",
              "</tr></thead>",
              "<tbody><tr>",
                "<td contenteditable='true' style='padding:10px 12px;border-bottom:1px solid #e4e7ed;border-right:1px solid #e4e7ed;font-weight:600;'>Revenu (M\u20ac)</td>",
                "<td contenteditable='true' style='padding:10px 12px;border-bottom:1px solid #e4e7ed;border-right:1px solid #e4e7ed;font-family:DM Mono,monospace;text-align:right;'>\u2014</td>",
                "<td contenteditable='true' style='padding:10px 12px;border-bottom:1px solid #e4e7ed;border-right:1px solid #e4e7ed;font-family:DM Mono,monospace;text-align:right;'>\u2014</td>",
                "<td contenteditable='true' style='padding:10px 12px;border-bottom:1px solid #e4e7ed;font-family:DM Mono,monospace;text-align:right;'>\u2014</td>",
                "<td style='border-bottom:1px solid #e4e7ed;width:32px;'></td>",
              "</tr></tbody>",
            "</table>",
            "<button onclick='plTableAddRow(this)' style='margin-top:6px;background:#f0f2f5;border:1px dashed #c0ccd8;color:#526070;padding:5px 14px;font-family:DM Mono,monospace;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;width:100%;'>+ Ligne</button>",
          "</div>"
        ].join("");
      } else if(res.type==="flags"){
        sec.innerHTML=[
          "<h2 class='section-title' contenteditable='true'>"+(res.title||"Risk Flags")+"</h2>",
          "<div class='pl-flag-wrap' style='position:relative;margin-bottom:8px;'>",
            "<div class='pl-flag-content' style='background:#faf0f1;border-left:3px solid #7a1824;padding:12px 40px 12px 15px;font-size:0.92rem;color:#7a1824;' contenteditable='true'>\u26a0 Nouveau risk flag</div>",
            "<button onclick='this.parentNode.remove()' style='position:absolute;top:8px;right:8px;background:none;border:none;color:#7a1824;font-size:14px;cursor:pointer;padding:2px 6px;opacity:0.6;' title='Supprimer'>\u00d7</button>",
          "</div>",
          "<div class='pl-flag-wrap' style='position:relative;margin-bottom:8px;'>",
            "<div class='pl-flag-content' style='background:#f0faf5;border-left:3px solid #185c38;padding:12px 40px 12px 15px;font-size:0.92rem;color:#185c38;' contenteditable='true'>\u2705 Signal positif</div>",
            "<button onclick='this.parentNode.remove()' style='position:absolute;top:8px;right:8px;background:none;border:none;color:#185c38;font-size:14px;cursor:pointer;padding:2px 6px;opacity:0.6;' title='Supprimer'>\u00d7</button>",
          "</div>",
          "<div style='margin-top:6px;'>",
            "<button onclick='plFlagsAddRow(this,\"red\")' style='background:#f0f2f5;border:1px dashed #ddb8be;color:#7a1824;padding:5px 14px;font-family:DM Mono,monospace;font-size:0.62rem;text-transform:uppercase;cursor:pointer;margin-right:6px;'>+ Risk flag</button>",
            "<button onclick='plFlagsAddRow(this,\"green\")' style='background:#f0f2f5;border:1px dashed #b0d4c0;color:#185c38;padding:5px 14px;font-family:DM Mono,monospace;font-size:0.62rem;text-transform:uppercase;cursor:pointer;'>+ Signal positif</button>",
          "</div>"
        ].join("");
      }
      /* Insertion position */
      var inserted=false;
      if(res.position&&res.position!=="__end__"){
        var target=document.getElementById(res.position)||document.querySelector("[data-pl-id='"+res.position+"']");
        if(target&&target.classList.contains("section-container")){target.insertAdjacentElement("afterend",sec);inserted=true;}
      }
      if(!inserted)document.querySelector(".content-area").appendChild(sec);
      /* Contrôles édition */
      var ctrl=document.createElement("div"); ctrl.className="pl-section-ctrl";
      var te=sec.querySelector(".section-title"),nm=te?te.textContent.trim().slice(0,36):"Section";
      ctrl.innerHTML="<button class='pl-ctrl-btn pl-hide-btn' data-hidden='false' onclick='plToggleSection(this)'>&#128065; Masquer</button><button class='pl-ctrl-btn pl-del-btn' onclick='plDeleteSection(this)'>&#x2715; Supprimer</button><span class='pl-ctrl-btn pl-label-btn'>"+nm+"</span>";
      sec.insertBefore(ctrl,sec.firstChild);
      plShowToast("Section ajout\u00e9e");
      /* Snapshot + passer en Phase 2 pour pouvoir sauvegarder */
      if(!editMode) {
        var editorEl=document.getElementById("plEditor"),ep=editorEl?editorEl.parentNode:null;
        if(editorEl&&ep)editorEl.remove();
        savedHTML=document.documentElement.outerHTML;
        if(editorEl&&ep)ep.appendChild(editorEl);
        editMode=true;
        document.body.classList.add("pl-editing");
      }
      var p1=document.getElementById("plActionsP1"); if(p1)p1.style.display="none";
      var p2=document.getElementById("plActionsP2"); if(p2)p2.style.display="flex";
      document.getElementById("plToggle").classList.add("editing");
      document.getElementById("plLabel").textContent=" Section ajout\u00e9e \u2014 sauvegardez";
      setTimeout(function(){sec.scrollIntoView({behavior:"smooth",block:"start"});},100);
    });
  };

  /* HELPERS TABLEAU */
  window.plTableAddRow = function(btn) {
    var table=btn.parentNode.querySelector("table"); if(!table)return;
    var tbody=table.querySelector("tbody"); if(!tbody)return;
    var cols=Math.max(table.querySelectorAll("thead tr th").length-1,1);
    var tr=document.createElement("tr");
    for(var i=0;i<cols;i++){
      var td=document.createElement("td"); td.contentEditable="true";
      td.style.cssText="padding:10px 12px;border-bottom:1px solid #e4e7ed;"+(i<cols-1?"border-right:1px solid #e4e7ed;":"")+(i===0?"font-weight:600;":"font-family:DM Mono,monospace;text-align:right;");
      td.textContent=i===0?"Nouvelle ligne":"\u2014"; tr.appendChild(td);
    }
    var emp=document.createElement("td"); emp.style.cssText="border-bottom:1px solid #e4e7ed;width:32px;"; tr.appendChild(emp);
    tbody.appendChild(tr);
    var first=tr.querySelector("td"); if(first){first.focus();var r=document.createRange();r.selectNodeContents(first);r.collapse(false);var s=window.getSelection();s.removeAllRanges();s.addRange(r);}
  };

  window.plTableAddCol = function(btn) {
    var table=btn.closest("table"); if(!table)return;
    var hr=table.querySelector("thead tr"); if(!hr)return;
    var addTh=btn.closest("th");
    var newTh=document.createElement("th"); newTh.contentEditable="true";
    newTh.style.cssText="padding:10px 12px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;border-right:1px solid rgba(255,255,255,0.1);min-width:80px;";
    newTh.textContent="Col"; hr.insertBefore(newTh,addTh);
    table.querySelectorAll("tbody tr").forEach(function(row){
      var cells=row.querySelectorAll("td"),last=cells[cells.length-1];
      var ntd=document.createElement("td"); ntd.contentEditable="true";
      ntd.style.cssText="padding:10px 12px;border-bottom:1px solid #e4e7ed;border-right:1px solid #e4e7ed;font-family:DM Mono,monospace;text-align:right;";
      ntd.textContent="\u2014"; row.insertBefore(ntd,last);
    });
    newTh.focus();
  };

  window.plFlagsAddRow = function(btn, type) {
    var isRed = type === "red";
    var color  = isRed ? "#7a1824" : "#185c38";
    var bg     = isRed ? "#faf0f1" : "#f0faf5";
    var border = isRed ? "#7a1824" : "#185c38";
    var text   = isRed ? "\u26a0 Nouveau risk flag" : "\u2705 Signal positif";

    /* Wrapper avec bouton × */
    var wrap = document.createElement("div");
    wrap.className = "pl-flag-wrap";
    wrap.style.cssText = "position:relative;margin-bottom:8px;";

    var div = document.createElement("div");
    div.className = "pl-flag-content";
    div.contentEditable = "true";
    div.style.cssText = "background:"+bg+";border-left:3px solid "+border+";padding:12px 40px 12px 15px;font-size:0.92rem;color:"+color+";";
    div.textContent = text;

    var del = document.createElement("button");
    del.textContent = "\u00d7";
    del.title = "Supprimer";
    del.style.cssText = "position:absolute;top:8px;right:8px;background:none;border:none;color:"+color+";font-size:14px;cursor:pointer;padding:2px 6px;opacity:0.6;";
    del.onclick = function() { wrap.remove(); };

    wrap.appendChild(div);
    wrap.appendChild(del);

    /* Insérer avant le div des boutons + (dernier enfant du section-container) */
    var container = btn.closest("div[style*='margin-top']") || btn.parentNode;
    container.parentNode.insertBefore(wrap, container);

    /* Focus sans getSelection pour éviter le freeze */
    setTimeout(function() {
      try { div.focus(); } catch(e) {}
    }, 50);
  };

  /* ── UTILITAIRE : Nettoie le HTML avant push ── */
  function plCleanHTML() {
    var editorEl=document.getElementById("plEditor"),ep=editorEl?editorEl.parentNode:null;
    if(editorEl&&ep)editorEl.remove();
    var clone=document.documentElement.cloneNode(true);
    if(editorEl&&ep)ep.appendChild(editorEl);
    ["#plEditor","#plToast","#plModal"].forEach(function(s){var el=clone.querySelector(s);if(el)el.remove();});
    clone.querySelectorAll(".pl-section-ctrl").forEach(function(el){el.remove();});
    clone.querySelectorAll("button[onclick^='plTableAdd'],button[onclick^='plFlagsAdd']").forEach(function(el){el.remove();});
    clone.querySelectorAll(".pl-flag-wrap button").forEach(function(el){el.remove();});
    clone.querySelectorAll("table.pl-custom-table thead tr th:last-child").forEach(function(th){if(th.querySelector("button")||th.style.width==="32px")th.remove();});
    clone.querySelectorAll("table.pl-custom-table tbody tr td:last-child").forEach(function(td){if(td.style.width==="32px"&&!td.textContent.trim())td.remove();});
    clone.querySelectorAll("[contenteditable]").forEach(function(el){
      el.removeAttribute("contenteditable"); el.style.cursor=""; el.style.outline="";
      var bg=el.style.background||el.style.backgroundColor||"";
      if(/rgba\(143,\s*168,\s*200/i.test(bg)||/rgba\(254,\s*249,\s*195/i.test(bg)){el.style.background="";}
    });
    if(clone.body)clone.body.classList.remove("pl-editing");
    return "<!DOCTYPE html>\n"+clone.outerHTML;
  }

  /* ── PUSH HTML VERS GITHUB DIRECTEMENT (pas de Make) ── */
  function plPushToGitHub(html, callback) {
    if (!GH_TOKEN || !GH_REPO || !GH_FILE) {
      /* Fallback : envoyer via Make webhook (ancien circuit) */
      fetch(WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({deal_id:DEAL_ID,updated_html:html,updated_at:new Date().toISOString(),source:"live_editor"})
      }).then(function(r){callback(r.ok);}).catch(function(){callback(false);});
      return;
    }
    var apiUrl = "https://api.github.com/repos/"+GH_REPO+"/contents/"+GH_FILE;
    var headers = {"Content-Type":"application/json","Authorization":"Bearer "+GH_TOKEN,"Accept":"application/vnd.github+json"};
    /* 1 — GET SHA (avec cache-buster) */
    fetch(apiUrl+"?t="+Date.now(), {method:"GET", headers:headers})
    .then(function(r){return r.json();})
    .then(function(meta){
      var sha = meta.sha || "";
      /* 2 — PUT avec le nouveau contenu */
      return fetch(apiUrl, {
        method:"PUT", headers:headers,
        body:JSON.stringify({
          message:"Proplace memo update",
          sha:sha,
          content:btoa(unescape(encodeURIComponent(html)))
        })
      });
    })
    .then(function(r){callback(r.ok);})
    .catch(function(){callback(false);});
  }

  /* ── SAVE (bouton Sauvegarder & Sync) ── */
  window.plSaveChanges = function() {
    plShowToast("Sauvegarde en cours\u2026");
    var html = plCleanHTML();
    plPushToGitHub(html, function(ok){
      if(ok){plShowToast("\u2713 Sauvegard\u00e9 instantan\u00e9ment !");plExitEditMode();}
      else  {plShowToast("\u26a0 \u00c9chec GitHub \u2014 v\u00e9rifiez data-github-token");}
    });
    /* Notifier aussi Make pour Airtable update (async, non bloquant) */
    if(WEBHOOK_URL) fetch(WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({deal_id:DEAL_ID,source:"live_editor_notify",updated_at:new Date().toISOString()})
    }).catch(function(){});
  };

  /* ── SAVE silencieux (link_file interne) ── */
  function plSaveHTMLNow(callback) {
    plPushToGitHub(plCleanHTML(), callback);
  }

  window.plCancelEdit = function() {
    if(savedHTML){try{var p=new DOMParser(),d=p.parseFromString(savedHTML,"text/html"),sc=d.querySelector(".content-area"),cc=document.querySelector(".content-area");if(sc&&cc)cc.innerHTML=sc.innerHTML;}catch(e){}}
    plExitEditMode(); savedHTML="";
  };

  function plExitEditMode() {
    editMode=false; document.body.classList.remove("pl-editing");
    var toggle=document.getElementById("plToggle"); if(toggle)toggle.classList.remove("editing");
    var icon=document.getElementById("plIcon"); if(icon)icon.innerHTML=getMainIcon();
    var lbl=document.getElementById("plLabel"); if(lbl)lbl.textContent=getMainLabel();
    var p1=document.getElementById("plActionsP1"); if(p1)p1.style.display="none";
    var p2=document.getElementById("plActionsP2"); if(p2)p2.style.display="none";
    document.querySelectorAll("[contenteditable]").forEach(function(el){
      if(!el.closest("#plEditor")){el.removeAttribute("contenteditable");el.style.cursor=el.style.outline="";
      var bg=el.style.background||el.style.backgroundColor||"";
      if(/rgba\(143,\s*168,\s*200/i.test(bg)||/rgba\(254,\s*249,\s*195/i.test(bg)){el.style.background="";}}
    });
    document.querySelectorAll(".pl-section-ctrl").forEach(function(el){el.remove();});
  }

  function plShowToast(msg) {
    var t=document.getElementById("plToast"); if(!t)return;
    t.textContent=msg; t.style.opacity="1";
    clearTimeout(window._plTimer);
    window._plTimer=setTimeout(function(){t.style.opacity="0";},4500);
  }

  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
})();
