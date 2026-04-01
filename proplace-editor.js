/* PROPLACE LIVE EDITOR - v3.0
   Usage: <script src="proplace-editor.js"
     data-webhook="WEBHOOK_URL"
     data-deal="DEAL_ID"
     data-status="STATUS_PROFUND">
   </script>
   Status values: NEW | SOURCED | CALL | CONSIDER | MONITOR | PASS | IN_PORTFOLIO
*/
(function() {
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var WEBHOOK_URL = currentScript.getAttribute("data-webhook") || "";
  var DEAL_ID     = currentScript.getAttribute("data-deal")    || "";
  var STATUS      = (currentScript.getAttribute("data-status") || "NEW").toUpperCase();
  var editMode    = false;
  var savedHTML   = "";

  /* ── LABEL CONTEXTUEL ── */
  function getMainLabel() {
    if (STATUS === "IN_PORTFOLIO") return " G\u00e9rer le Portfolio";
    if (STATUS === "CALL")        return " D\u00e9marrer la Due Diligence";
    return " \u00c9diter le M\u00e9mo";
  }
  function getMainIcon() {
    if (STATUS === "IN_PORTFOLIO") return "&#128202;";
    if (STATUS === "CALL")        return "&#128270;";
    return "&#9998;";
  }

  /* ── STYLES ── */
  var style = document.createElement("style");
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
    "#plModal{position:fixed;inset:0;background:rgba(11,25,41,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;}",
    "#plModalBox{background:#fff;padding:28px;max-width:460px;width:100%;box-shadow:0 8px 40px rgba(11,25,41,0.2);border-top:3px solid #0f1f33;}",
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
    ".pl-modal-cancel{background:#f4f5f7;color:#0b1929;border:1px solid #d4d9e2;padding:9px 18px;font-size:11px;font-weight:500;cursor:pointer;font-family:'DM Mono','Courier New',monospace;letter-spacing:0.08em;text-transform:uppercase;}"
  ].join("");
  document.head.appendChild(style);

  /* ── MODAL GÉNÉRIQUE ── */
  function showModal(config, callback) {
    var existing = document.getElementById("plModal");
    if (existing) existing.remove();
    var modal = document.createElement("div");
    modal.id = "plModal";
    var fieldsHTML = (config.fields || []).map(function(f) {
      if (f.type === "select") {
        var opts = f.options.map(function(o) {
          return "<option value='" + o.value + "'>" + o.label + "</option>";
        }).join("");
        return "<label class='pl-modal-label'>" + f.label + "</label><select class='pl-modal-input' data-field='" + f.key + "'>" + opts + "</select>";
      }
      return "<label class='pl-modal-label'>" + f.label + "</label><input class='pl-modal-input' type='text' placeholder='" + (f.placeholder || "") + "' data-field='" + f.key + "'>";
    }).join("");
    modal.innerHTML = "<div id='plModalBox'><h2 id='plModalTitle'>" + config.title + "</h2>" +
      (config.subtitle ? "<p id='plModalSubtitle'>" + config.subtitle + "</p>" : "") +
      fieldsHTML +
      "<div id='plModalActions'><button class='pl-modal-cancel'>Annuler</button><button class='pl-modal-ok'>" + (config.okLabel || "Confirmer") + "</button></div></div>";
    document.body.appendChild(modal);
    modal.querySelector(".pl-modal-cancel").onclick = function() { modal.remove(); };
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    modal.querySelector(".pl-modal-ok").onclick = function() {
      var result = {};
      modal.querySelectorAll("[data-field]").forEach(function(el) { result[el.getAttribute("data-field")] = el.value; });
      modal.remove();
      callback(result);
    };
    var first = modal.querySelector("input,select");
    if (first) setTimeout(function() { first.focus(); }, 50);
  }

  /* ── MODAL PDF UPLOAD ── */
  function showPDFModal() {
    var existing = document.getElementById("plModal");
    if (existing) existing.remove();
    var selectedFile = null;
    var selectedBase64 = null;
    var modal = document.createElement("div");
    modal.id = "plModal";
    modal.innerHTML = [
      "<div id='plModalBox'>",
        "<h2 id='plModalTitle'>&#128196; Analyser un document PDF</h2>",
        "<p id='plModalSubtitle'>",
          "Stan va <strong>lire et analyser le contenu complet du PDF</strong>, ",
          "puis mettre à jour automatiquement la section Due Diligence ou Portfolio de ce mémo. ",
          "Le fichier sera sauvegardé dans le dossier Drive de la startup. ",
          "<strong>Formats acceptés : PDF uniquement.</strong> Pour lier un fichier sans analyse, ",
          "utilisez le bouton « Lier un fichier ».",
        "</p>",
        "<div id='plDropZone'>",
          "<p>&#128196; <strong>Cliquez ici</strong> ou glissez-déposez votre PDF</p>",
          "<small>PDF uniquement &middot; Taille max recommandée : 10 Mo</small>",
        "</div>",
        "<div id='plFileInfo'></div>",
        "<label class='pl-modal-label' style='margin-top:16px;'>Note sur ce document (optionnel — apparaîtra dans le mémo)</label>",
        "<input class='pl-modal-input' type='text' id='plPdfNote' placeholder='Ex : Term sheet reçu de Partech — version finale'>",
        "<div id='plModalActions'>",
          "<button class='pl-modal-cancel'>Annuler</button>",
          "<button class='pl-modal-ok' id='plPdfConfirm' disabled>Envoyer à Stan &#x2192;</button>",
        "</div>",
      "</div>"
    ].join("");
    document.body.appendChild(modal);

    var fileInput  = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pdf,application/pdf";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    var dropZone   = document.getElementById("plDropZone");
    var fileInfo   = document.getElementById("plFileInfo");
    var confirmBtn = document.getElementById("plPdfConfirm");

    function handleFile(file) {
      if (!file || file.type !== "application/pdf") {
        fileInfo.style.color = "#7a1824";
        fileInfo.textContent = "\u26a0 Fichier invalide \u2014 seuls les PDF sont accept\u00e9s.";
        return;
      }
      fileInfo.style.color = "#526070";
      fileInfo.textContent = "Lecture en cours\u2026";
      var reader = new FileReader();
      reader.onload = function(ev) {
        selectedFile   = file;
        selectedBase64 = ev.target.result.split(",")[1];
        fileInfo.style.color = "#185c38";
        fileInfo.textContent = "\u2713 " + file.name + " (" + Math.round(file.size / 1024) + " Ko)";
        confirmBtn.disabled = false;
      };
      reader.onerror = function() {
        fileInfo.style.color = "#7a1824";
        fileInfo.textContent = "\u26a0 Erreur de lecture \u2014 r\u00e9essayez.";
      };
      reader.readAsDataURL(file);
    }

    dropZone.onclick = function() { fileInput.click(); };
    fileInput.onchange = function(e) { if (e.target.files[0]) handleFile(e.target.files[0]); fileInput.value = ""; };
    dropZone.addEventListener("dragover",  function(e) { e.preventDefault(); dropZone.classList.add("dragover"); });
    dropZone.addEventListener("dragleave", function()  { dropZone.classList.remove("dragover"); });
    dropZone.addEventListener("drop", function(e) {
      e.preventDefault(); dropZone.classList.remove("dragover");
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    function cleanup() { modal.remove(); fileInput.remove(); }
    modal.querySelector(".pl-modal-cancel").onclick = cleanup;
    modal.onclick = function(e) { if (e.target === modal) cleanup(); };

    confirmBtn.onclick = function() {
      if (!selectedBase64) return;
      var note = document.getElementById("plPdfNote").value || "";
      cleanup();
      plShowToast("Envoi \u00e0 Stan en cours\u2026 Le m\u00e9mo sera mis \u00e0 jour dans 30 \u00e0 60 secondes.");
      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_id:     DEAL_ID,
          source:      "document_upload",
          file_base64: selectedBase64,
          file_name:   selectedFile.name,
          file_type:   selectedFile.type,
          note:        note,
          updated_at:  new Date().toISOString()
        })
      }).then(function(r) {
        if (r.ok) plShowToast("\u2713 Document re\u00e7u \u2014 rechargez la page dans 60 secondes pour voir la mise \u00e0 jour.");
        else       plShowToast("Erreur serveur \u2014 r\u00e9essayez");
      }).catch(function() { plShowToast("Connexion \u00e9chou\u00e9e \u2014 v\u00e9rifiez le webhook"); });
    };
  }

  /* ── INIT ── */
  function init() {
    var fab = document.createElement("div");
    fab.id = "plEditor";
    fab.innerHTML = [
      "<button id='plToggle' onclick='plToggleEdit()'>",
        "<span id='plIcon'>" + getMainIcon() + "</span>",
        "<span id='plLabel'>" + getMainLabel() + "</span>",
      "</button>",
      "<div id='plActions'>",
        "<button class='pl-action-btn pl-btn-save'    onclick='plSaveChanges()'>&#128190; Sauvegarder &amp; Sync</button>",
        "<button class='pl-action-btn pl-btn-pdf'     onclick='plOpenPDFUpload()'>&#128196; Analyser un document PDF</button>",
        "<button class='pl-action-btn pl-btn-link'    onclick='plAttachLink()'>&#128279; Lier un fichier (sans analyse)</button>",
        "<button class='pl-action-btn pl-btn-section' onclick='plAddSection()'>+ Ajouter une section manuellement</button>",
        "<button class='pl-action-btn pl-btn-cancel'  onclick='plCancelEdit()'>&#x2715; Annuler</button>",
      "</div>",
      "<div id='plToast'></div>"
    ].join("");
    document.body.appendChild(fab);
  }

  /* ── TOGGLE ── */
  window.plToggleEdit = function() {
    editMode = !editMode;
    if (editMode) { savedHTML = document.documentElement.outerHTML; plEnableEditing(); }
    else          { plCancelEdit(); }
  };

  window.plOpenPDFUpload = function() { showPDFModal(); };

  function plEnableEditing() {
    document.getElementById("plToggle").classList.add("editing");
    document.getElementById("plLabel").textContent = " En cours d'\u00e9dition\u2026";
    document.getElementById("plActions").style.display = "flex";
    var sel = ".content-area p,.content-area h1,.content-area h2,.content-area h3,.content-area h4,.content-area li,.content-area td,.content-area b,.content-area span.text-block,.content-area div.text-block";
    document.querySelectorAll(sel).forEach(function(el) {
      if (!el.closest("#plEditor") && !el.closest("#plModal")) {
        el.setAttribute("contenteditable","true"); el.style.cursor = "text";
      }
    });
    document.querySelectorAll(".section-container").forEach(function(sec) {
      if (sec.querySelector(".pl-section-ctrl")) return;
      var title = sec.querySelector(".section-title");
      var name  = title ? title.textContent.trim().slice(0,36) : "Section";
      var ctrl  = document.createElement("div");
      ctrl.className = "pl-section-ctrl";
      ctrl.innerHTML = "<button class='pl-ctrl-btn pl-hide-btn' data-hidden='false' onclick='plToggleSection(this)'>&#128065; Masquer</button>" +
        "<button class='pl-ctrl-btn pl-del-btn' onclick='plDeleteSection(this)'>&#x2715; Supprimer</button>" +
        "<span class='pl-ctrl-btn pl-label-btn'>" + name + "</span>";
      sec.insertBefore(ctrl, sec.firstChild);
    });
  }

  window.plToggleSection = function(btn) {
    var sec = btn.closest(".section-container");
    var hidden = btn.dataset.hidden === "true";
    Array.from(sec.children).forEach(function(c) {
      if (!c.classList.contains("pl-section-ctrl")) {
        c.style.opacity = hidden ? "1" : "0.1"; c.style.pointerEvents = hidden ? "" : "none";
      }
    });
    btn.dataset.hidden = hidden ? "false" : "true";
    btn.textContent    = hidden ? "\ud83d\udc41 Masquer" : "\ud83d\udeab Masqu\u00e9";
    btn.style.background = hidden ? "" : "#0f1f33"; btn.style.color = hidden ? "" : "#fff";
  };

  window.plDeleteSection = function(btn) {
    var sec = btn.closest(".section-container");
    var t   = sec.querySelector(".section-title");
    showModal({ title: "Supprimer \u201c" + (t ? t.textContent.trim() : "cette section") + "\u201d ?", fields: [] }, function() {
      sec.remove(); plShowToast("Section supprim\u00e9e");
    });
  };

  window.plAddSection = function() {
    showModal({
      title: "Ajouter une section",
      fields: [
        { key: "type", label: "Type", type: "select", options: [
          { value: "text",  label: "Texte libre" },
          { value: "table", label: "Tableau financier" },
          { value: "flags", label: "Risk flags & signaux" }
        ]},
        { key: "title", label: "Titre", placeholder: "Ex : Notes de Due Diligence" }
      ]
    }, function(res) {
      if (!res.type) return;
      var sec = document.createElement("div"); sec.className = "section-container";
      if (res.type === "text") {
        sec.innerHTML = "<h2 class='section-title' contenteditable='true'>" + (res.title || "Nouvelle Section") + "</h2><p class='text-block' contenteditable='true' style='line-height:1.75;'>R\u00e9digez votre contenu ici\u2026</p>";
      } else if (res.type === "table") {
        sec.innerHTML = "<h2 class='section-title' contenteditable='true'>" + (res.title || "Tableau Financier") + "</h2><div style='overflow-x:auto;'><table style='width:100%;border-collapse:collapse;font-size:0.9rem;'><thead><tr style='background:#0f1f33;'><th contenteditable='true' style='padding:10px;text-align:left;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;'>M\u00e9trique</th><th contenteditable='true' style='padding:10px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;'>Y1</th><th contenteditable='true' style='padding:10px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;'>Y2</th><th contenteditable='true' style='padding:10px;color:#fff;font-family:DM Mono,monospace;font-size:0.62rem;'>Y3</th></tr></thead><tbody><tr><td contenteditable='true' style='padding:10px;border-bottom:1px solid #e4e7ed;font-weight:600;'>Revenu (M\u20ac)</td><td contenteditable='true' style='padding:10px;border-bottom:1px solid #e4e7ed;font-family:DM Mono,monospace;'>\u2014</td><td contenteditable='true' style='padding:10px;border-bottom:1px solid #e4e7ed;font-family:DM Mono,monospace;'>\u2014</td><td contenteditable='true' style='padding:10px;border-bottom:1px solid #e4e7ed;font-family:DM Mono,monospace;'>\u2014</td></tr></tbody></table></div>";
      } else if (res.type === "flags") {
        sec.innerHTML = "<h2 class='section-title' contenteditable='true'>" + (res.title || "Risk Flags") + "</h2><div style='background:#faf0f1;border-left:3px solid #7a1824;padding:12px 15px;font-size:0.92rem;color:#7a1824;margin-bottom:10px;font-style:italic;' contenteditable='true'>\u26a0 Nouveau risk flag</div><div style='background:#f0faf5;border-left:3px solid #185c38;padding:12px 15px;font-size:0.92rem;color:#185c38;font-style:italic;' contenteditable='true'>\u2705 Signal positif</div>";
      }
      document.querySelector(".content-area").appendChild(sec);
      plShowToast("Section ajout\u00e9e"); sec.scrollIntoView({ behavior:"smooth", block:"center" });
    });
  };

  window.plAttachLink = function() {
    showModal({
      title: "Lier un fichier externe",
      subtitle: "Ajoutez un lien vers un fichier existant (Google Drive, Notion, Excel online\u2026). Ce lien ne sera PAS analys\u00e9 par Stan. Pour une analyse automatique, utilisez \u00ab\u00a0Analyser un document PDF\u00a0\u00bb.",
      fields: [
        { key: "url",   label: "URL du fichier", placeholder: "https://drive.google.com/\u2026" },
        { key: "label", label: "Nom affich\u00e9", placeholder: "Ex : Mod\u00e8le financier Q1 2025" }
      ]
    }, function(res) {
      if (!res.url) return;
      var label = res.label || "Document li\u00e9";
      var date  = new Date().toLocaleDateString("fr-FR");
      var block = document.getElementById("pl-linked-file");
      if (!block) { block = document.createElement("div"); block.id = "pl-linked-file"; block.className = "section-container"; }
      block.innerHTML = "<h2 class='section-title'>Fichier li\u00e9</h2><div style='background:#f4f5f7;border:1px solid #d4d9e2;padding:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;'><div><div style='font-weight:600;font-size:15px;color:#0f1f33;' contenteditable='true'>" + label + "</div><div style='font-family:DM Mono,monospace;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:#9eaaba;margin-top:4px;'>Ajout\u00e9 le " + date + "</div></div><a href='" + res.url + "' target='_blank' style='background:#0f1f33;color:#fff;padding:9px 16px;font-family:DM Mono,monospace;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;'>Ouvrir \u2192</a></div>";
      if (!block.parentElement) document.querySelector(".content-area").appendChild(block);
      plShowToast("Fichier li\u00e9 \u2014 sauvegardez pour confirmer");
      block.scrollIntoView({ behavior:"smooth", block:"center" });
    });
  };

  window.plSaveChanges = function() {
    plShowToast("Sauvegarde en cours\u2026");
    var clone = document.documentElement.cloneNode(true);
    ["#plEditor","#plToast","#plModal"].forEach(function(s) { var el = clone.querySelector(s); if (el) el.remove(); });
    clone.querySelectorAll(".pl-section-ctrl").forEach(function(el) { el.remove(); });
    clone.querySelectorAll("[contenteditable]").forEach(function(el) {
      el.removeAttribute("contenteditable"); el.style.cursor = el.style.outline = el.style.background = "";
    });
    var html = "<!DOCTYPE html>\n" + clone.outerHTML;
    fetch(WEBHOOK_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal_id: DEAL_ID, updated_html: html, updated_at: new Date().toISOString(), source: "live_editor" })
    }).then(function(r) {
      if (r.ok) { plShowToast("\u2713 Sauvegard\u00e9 et synchronis\u00e9"); plExitEditMode(); }
      else       { plShowToast("Erreur serveur \u2014 r\u00e9essayez"); }
    }).catch(function() { plShowToast("Connexion \u00e9chou\u00e9e"); });
  };

  window.plCancelEdit = function() { document.open(); document.write(savedHTML); document.close(); };

  function plExitEditMode() {
    editMode = false;
    var toggle = document.getElementById("plToggle"); if (toggle) toggle.classList.remove("editing");
    var lbl    = document.getElementById("plLabel");  if (lbl)    lbl.innerHTML = getMainIcon() + getMainLabel();
    var acts   = document.getElementById("plActions"); if (acts)   acts.style.display = "none";
    document.querySelectorAll("[contenteditable]").forEach(function(el) {
      if (!el.closest("#plEditor")) { el.removeAttribute("contenteditable"); el.style.cursor = el.style.outline = el.style.background = ""; }
    });
    document.querySelectorAll(".pl-section-ctrl").forEach(function(el) { el.remove(); });
  }

  function plShowToast(msg) {
    var t = document.getElementById("plToast"); if (!t) return;
    t.textContent = msg; t.style.opacity = "1";
    clearTimeout(window._plTimer);
    window._plTimer = setTimeout(function() { t.style.opacity = "0"; }, 4500);
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); }
  else { init(); }
})();
