/* PROPLACE LIVE EDITOR - v2.0
   Usage: <script src="proplace-editor.js"
     data-webhook="WEBHOOK_URL"
     data-deal="DEAL_ID"
     data-status="STATUS_PROFUND">
   </script>

   status values: SOURCED | CALL | CONSIDER | MONITOR | PASS | IN_PORTFOLIO
*/
(function() {
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var WEBHOOK_URL = currentScript.getAttribute("data-webhook") || "";
  var DEAL_ID     = currentScript.getAttribute("data-deal")    || "";
  var STATUS      = (currentScript.getAttribute("data-status") || "").toUpperCase();

  var editMode = false;
  var savedHTML = "";

  /* ── Labels contextuels ── */
  function getMainLabel() {
    if (STATUS === "IN_PORTFOLIO") return "Gérer le portfolio";
    if (STATUS === "CALL" || STATUS === "CONSIDER") return "Démarrer la Due Diligence";
    return "Éditer le mémo";
  }
  function getMainIcon() {
    if (STATUS === "IN_PORTFOLIO") return "&#128202;";
    if (STATUS === "CALL" || STATUS === "CONSIDER") return "&#128270;";
    return "&#9998;";
  }

  /* ── CSS injecté ── */
  function injectStyles() {
    var style = document.createElement("style");
    style.textContent = [
      "#pl-editor-root {",
      "  position:fixed;bottom:28px;right:28px;z-index:9999;",
      "  display:flex;flex-direction:column;align-items:flex-end;gap:8px;",
      "  font-family:'EB Garamond',Georgia,serif;",
      "}",
      "#pl-toggle {",
      "  background:#0f1f33;color:#fff;border:none;",
      "  border-radius:3px;padding:10px 20px;",
      "  font-family:'DM Mono','Courier New',monospace;",
      "  font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;",
      "  cursor:pointer;box-shadow:0 4px 20px rgba(15,31,51,0.25);",
      "  display:flex;align-items:center;gap:8px;",
      "  transition:background 0.15s;",
      "}",
      "#pl-toggle:hover { background:#1e3553; }",
      "#pl-toggle.editing { background:#f59e0b;color:#0f1f33; }",
      ".pl-action-btn {",
      "  border:none;border-radius:3px;padding:8px 16px;",
      "  font-family:'DM Mono','Courier New',monospace;",
      "  font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;",
      "  cursor:pointer;transition:all 0.15s;",
      "}",
      ".pl-btn-save   { background:#185c38;color:#fff; }",
      ".pl-btn-save:hover   { background:#14532d; }",
      ".pl-btn-upload { background:#183460;color:#fff; }",
      ".pl-btn-upload:hover { background:#1e3a6e; }",
      ".pl-btn-add    { background:#4f46e5;color:#fff; }",
      ".pl-btn-add:hover    { background:#4338ca; }",
      ".pl-btn-cancel { background:#f4f5f7;color:#0b1929;border:1px solid #d4d9e2; }",
      ".pl-btn-cancel:hover { background:#e4e7ed; }",
      "#pl-actions { display:none;flex-direction:column;gap:6px;align-items:flex-end; }",
      "#pl-toast {",
      "  position:fixed;bottom:100px;right:28px;z-index:9999;",
      "  background:#0f1f33;color:#fff;",
      "  padding:10px 18px;border-radius:3px;",
      "  font-family:'DM Mono','Courier New',monospace;",
      "  font-size:0.6rem;letter-spacing:0.06em;",
      "  opacity:0;transition:opacity 0.3s;pointer-events:none;max-width:280px;",
      "}",
      "/* Edit highlights */",
      "[contenteditable]:focus { background:#fefce8 !important;outline:none !important; }",
      ".pl-section-ctrl {",
      "  display:flex;gap:6px;margin-bottom:10px;padding-bottom:10px;",
      "  border-bottom:1px dashed #e4e7ed;",
      "}",
      ".pl-ctrl-btn {",
      "  padding:3px 10px;font-family:'DM Mono',monospace;font-size:0.55rem;",
      "  letter-spacing:0.08em;text-transform:uppercase;font-weight:600;",
      "  border-radius:2px;cursor:pointer;border:1px solid #d4d9e2;",
      "  background:#f4f5f7;color:#526070;",
      "}",
      ".pl-ctrl-btn.danger { background:#faeef0;border-color:#ddb8be;color:#7a1824; }",
    ].join("\n");
    document.head.appendChild(style);
  }

  /* ── DOM ── */
  function init() {
    injectStyles();

    var root = document.createElement("div");
    root.id = "pl-editor-root";

    /* Bouton principal */
    var toggle = document.createElement("button");
    toggle.id = "pl-toggle";
    toggle.innerHTML = getMainIcon() + " <span id='pl-label'>" + getMainLabel() + "</span>";
    toggle.onclick = plToggleEdit;
    root.appendChild(toggle);

    /* Actions panel */
    var actions = document.createElement("div");
    actions.id = "pl-actions";

    var btnSave = document.createElement("button");
    btnSave.className = "pl-action-btn pl-btn-save";
    btnSave.innerHTML = "&#128190; Sauvegarder &amp; Sync";
    btnSave.onclick = plSaveChanges;
    actions.appendChild(btnSave);

    var btnUpload = document.createElement("button");
    btnUpload.className = "pl-action-btn pl-btn-upload";
    btnUpload.innerHTML = "&#128196; Ajouter un document PDF";
    btnUpload.onclick = function() { fileInput.click(); };
    actions.appendChild(btnUpload);

    var btnAdd = document.createElement("button");
    btnAdd.className = "pl-action-btn pl-btn-add";
    btnAdd.innerHTML = "+ Ajouter une section";
    btnAdd.onclick = plAddSection;
    actions.appendChild(btnAdd);

    var btnCancel = document.createElement("button");
    btnCancel.className = "pl-action-btn pl-btn-cancel";
    btnCancel.innerHTML = "&#x2715; Annuler";
    btnCancel.onclick = plCancelEdit;
    actions.appendChild(btnCancel);

    root.appendChild(actions);
    document.body.appendChild(root);

    /* Toast */
    var toast = document.createElement("div");
    toast.id = "pl-toast";
    document.body.appendChild(toast);

    /* File input caché — PDF uniquement */
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".pdf,application/pdf";
    fileInput.style.display = "none";
    fileInput.onchange = handleFileUpload;
    document.body.appendChild(fileInput);
  }

  var fileInput;

  /* ── Toggle edit mode ── */
  window.plToggleEdit = function() {
    editMode = !editMode;
    var toggle = document.getElementById("pl-toggle");
    var actions = document.getElementById("pl-actions");
    if (editMode) {
      savedHTML = document.documentElement.outerHTML;
      toggle.classList.add("editing");
      document.getElementById("pl-label").textContent = "En cours d'édition...";
      actions.style.display = "flex";
      enableEditing();
    } else {
      plCancelEdit();
    }
  };

  function enableEditing() {
    var selectors = [
      ".content-area p",".content-area h1",".content-area h2",".content-area h3",
      ".content-area h4",".content-area li",".content-area td",".content-area th",
      ".content-area b",".content-area span.text-block"
    ].join(",");
    var els = document.querySelectorAll(selectors);
    for (var i = 0; i < els.length; i++) {
      if (!els[i].closest("#pl-editor-root")) {
        els[i].setAttribute("contenteditable","true");
        els[i].style.cursor = "text";
      }
    }
    /* Contrôles de section */
    var secs = document.querySelectorAll(".section-container");
    for (var j = 0; j < secs.length; j++) {
      if (secs[j].querySelector(".pl-section-ctrl")) continue;
      var title = secs[j].querySelector(".section-title");
      var name  = title ? title.textContent.trim().slice(0,35) : "Section";
      var ctrl  = document.createElement("div");
      ctrl.className = "pl-section-ctrl";
      ctrl.innerHTML =
        '<button class="pl-ctrl-btn" onclick="plToggleSection(this)" data-hidden="false">&#128065; Masquer</button>' +
        '<button class="pl-ctrl-btn danger" onclick="plDeleteSection(this)">&#x2715; Supprimer</button>' +
        '<span style="font-family:\'DM Mono\',monospace;font-size:0.55rem;color:#9eaaba;padding:3px 6px;">' + name + '</span>';
      secs[j].insertBefore(ctrl, secs[j].firstChild);
    }
  }

  window.plToggleSection = function(btn) {
    var sec = btn.closest(".section-container");
    var isHidden = btn.dataset.hidden === "true";
    var children = sec.children;
    for (var i = 0; i < children.length; i++) {
      if (!children[i].classList.contains("pl-section-ctrl")) {
        children[i].style.opacity = isHidden ? "1" : "0.1";
        children[i].style.pointerEvents = isHidden ? "" : "none";
      }
    }
    btn.dataset.hidden = isHidden ? "false" : "true";
    btn.innerHTML = isHidden ? "&#128065; Masquer" : "&#128683; Masqué";
    btn.style.background = isHidden ? "#f4f5f7" : "#0f1f33";
    btn.style.color = isHidden ? "#526070" : "#fff";
  };

  window.plDeleteSection = function(btn) {
    var sec = btn.closest(".section-container");
    var t = sec.querySelector(".section-title");
    if (!confirm("Supprimer : " + (t ? t.textContent.trim() : "cette section") + " ?")) return;
    sec.remove();
    plShowToast("Section supprimée");
  };

  /* ── Ajout de section ── */
  window.plAddSection = function() {
    var choice = prompt("Type de section :\n1 - Texte libre\n2 - Tableau financier\n3 - Risk flags\n4 - Lien fichier externe");
    if (!choice) return;
    var sec = document.createElement("div");
    sec.className = "section-container";
    var c = choice.charAt(0);
    if (c === "1") {
      sec.innerHTML = '<h2 class="section-title" contenteditable="true">Nouvelle section</h2>' +
        '<p class="text-block" contenteditable="true" style="line-height:1.7;">Écrivez votre contenu ici...</p>';
    } else if (c === "2") {
      sec.innerHTML = '<h2 class="section-title" contenteditable="true">Tableau financier</h2>' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.88rem;">' +
        '<thead><tr style="background:#f4f5f7;"><th contenteditable="true" style="padding:10px;text-align:left;border-bottom:2px solid #d4d9e2;">Métrique</th>' +
        '<th contenteditable="true" style="padding:10px;text-align:right;border-bottom:2px solid #d4d9e2;">A1</th>' +
        '<th contenteditable="true" style="padding:10px;text-align:right;border-bottom:2px solid #d4d9e2;">A2</th>' +
        '<th contenteditable="true" style="padding:10px;text-align:right;border-bottom:2px solid #d4d9e2;">A3</th></tr></thead>' +
        '<tbody><tr><td contenteditable="true" style="padding:10px;font-weight:600;border-bottom:1px solid #e4e7ed;">Revenue (M€)</td>' +
        '<td contenteditable="true" style="padding:10px;text-align:right;border-bottom:1px solid #e4e7ed;">—</td>' +
        '<td contenteditable="true" style="padding:10px;text-align:right;border-bottom:1px solid #e4e7ed;">—</td>' +
        '<td contenteditable="true" style="padding:10px;text-align:right;border-bottom:1px solid #e4e7ed;">—</td></tr></tbody>' +
        '</table></div>';
    } else if (c === "3") {
      sec.innerHTML = '<h2 class="section-title" contenteditable="true">Risk Flags</h2>' +
        '<div style="background:#faeef0;border-left:3px solid #7a1824;padding:10px 14px;margin-bottom:8px;font-size:0.88rem;color:#7a1824;" contenteditable="true">🚨 Nouveau risk flag</div>' +
        '<div style="background:#e8f4ee;border-left:3px solid #185c38;padding:10px 14px;font-size:0.88rem;color:#185c38;" contenteditable="true">✅ Signal positif</div>';
    } else if (c === "4") {
      var url   = prompt("URL du fichier (Drive, GitHub, etc.) :"); if (!url) return;
      var label = prompt("Nom du fichier :", "Document") || "Document";
      var date  = new Date().toLocaleDateString("fr-FR");
      sec.innerHTML = '<h2 class="section-title">Fichier lié</h2>' +
        '<div style="background:#f4f5f7;border:1px solid #d4d9e2;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">' +
        '<div><div style="font-family:\'EB Garamond\',serif;font-weight:600;font-size:0.95rem;" contenteditable="true">' + label + '</div>' +
        '<div style="font-family:\'DM Mono\',monospace;font-size:0.58rem;color:#9eaaba;margin-top:4px;">Ajouté le ' + date + '</div></div>' +
        '<a href="' + url + '" target="_blank" style="background:#0f1f33;color:#fff;padding:7px 16px;border-radius:2px;text-decoration:none;font-family:\'DM Mono\',monospace;font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">Ouvrir →</a></div>';
    }
    var ca = document.querySelector(".content-area");
    if (ca) { ca.appendChild(sec); sec.scrollIntoView({behavior:"smooth",block:"center"}); }
    plShowToast("Section ajoutée");
  };

  /* ── Upload PDF ── */
  function handleFileUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    /* Reset pour permettre re-upload du même fichier */
    fileInput.value = "";
    var note = prompt("Note sur ce document (optionnel — sera visible dans le mémo) :") || "";
    plShowToast("Lecture du PDF en cours...");
    var reader = new FileReader();
    reader.onload = function(ev) {
      var base64 = ev.target.result.split(",")[1];
      plShowToast("Envoi à Stan pour analyse...");
      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          deal_id:     DEAL_ID,
          source:      "document_upload",
          file_base64: base64,
          file_name:   file.name,
          file_type:   file.type,
          note:        note,
          updated_at:  new Date().toISOString()
        })
      }).then(function(res) {
        if (res.ok) {
          plShowToast("Document reçu — Stan analyse et met à jour le mémo (30–60 sec)");
        } else {
          plShowToast("Erreur serveur — réessayez");
        }
      }).catch(function() {
        plShowToast("Connexion échouée — vérifiez le webhook");
      });
    };
    reader.onerror = function() { plShowToast("Erreur lecture fichier"); };
    reader.readAsDataURL(file);
  }

  /* ── Save & Sync (live_editor) ── */
  window.plSaveChanges = function() {
    plShowToast("Sauvegarde en cours...");
    var clone = document.documentElement.cloneNode(true);
    /* Nettoyage avant envoi */
    clone.querySelectorAll(".pl-section-ctrl").forEach(function(el) { el.remove(); });
    clone.querySelectorAll("[contenteditable]").forEach(function(el) {
      el.removeAttribute("contenteditable");
      el.style.background = "";
      el.style.cursor = "";
    });
    var ed = clone.querySelector("#pl-editor-root"); if (ed) ed.remove();
    var toast = clone.querySelector("#pl-toast"); if (toast) toast.remove();
    var updatedHTML = "<!DOCTYPE html>\n" + clone.outerHTML;

    fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        deal_id:      DEAL_ID,
        source:       "live_editor",
        updated_html: updatedHTML,
        updated_at:   new Date().toISOString()
      })
    }).then(function(res) {
      if (res.ok) {
        plShowToast("Mémo sauvegardé et synchronisé ✓");
        plExitEditMode();
      } else {
        plShowToast("Erreur serveur — réessayez");
      }
    }).catch(function() {
      plShowToast("Connexion échouée — vérifiez le webhook");
    });
  };

  window.plCancelEdit = function() {
    if (savedHTML) {
      document.open(); document.write(savedHTML); document.close();
    }
  };

  function plExitEditMode() {
    editMode = false;
    var toggle = document.getElementById("pl-toggle"); if (!toggle) return;
    toggle.classList.remove("editing");
    document.getElementById("pl-label").textContent = getMainLabel();
    document.getElementById("pl-actions").style.display = "none";
    document.querySelectorAll("[contenteditable]").forEach(function(el) {
      if (!el.closest("#pl-editor-root")) {
        el.removeAttribute("contenteditable");
        el.style.background = "";
        el.style.cursor = "";
      }
    });
    document.querySelectorAll(".pl-section-ctrl").forEach(function(el) { el.remove(); });
  }

  /* ── Toast ── */
  function plShowToast(msg) {
    var t = document.getElementById("pl-toast"); if (!t) return;
    t.textContent = msg; t.style.opacity = "1";
    clearTimeout(window._plToastTimer);
    window._plToastTimer = setTimeout(function() { t.style.opacity = "0"; }, 3500);
  }

  /* ── Init ── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
