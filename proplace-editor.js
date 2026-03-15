/* PROPLACE LIVE EDITOR - v1.0
   Usage: <script src="proplace-editor.js" data-webhook="WEBHOOK_URL" data-deal="DEAL_ID"></script>
*/
(function() {
  var currentScript = document.currentScript || (function() {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var WEBHOOK_URL = currentScript.getAttribute("data-webhook") || "";
  var DEAL_ID = currentScript.getAttribute("data-deal") || "";
  var editMode = false;
  var savedHTML = "";

  function init() {
    var fab = document.createElement("div");
    fab.innerHTML = '<div id="plEditor" style="position:fixed;bottom:28px;right:28px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:10px;font-family:Segoe UI,system-ui,sans-serif;">'
      + '<button id="plToggle" onclick="plToggleEdit()" style="background:#0f172a;color:white;border:none;border-radius:50px;padding:12px 22px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 24px rgba(0,0,0,0.2);display:flex;align-items:center;gap:8px;font-family:inherit;">'
      + '<span id="plIcon">&#9998;</span><span id="plLabel"> Edit Memo</span></button>'
      + '<div id="plActions" style="display:none;flex-direction:column;gap:8px;align-items:flex-end;">'
      + '<button onclick="plSaveChanges()" style="background:#16a34a;color:white;border:none;border-radius:50px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(22,163,74,0.3);">&#128190; Save &amp; Sync</button>'
      + '<button onclick="plAttachExcel()" style="background:#2563eb;color:white;border:none;border-radius:50px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">&#128206; Link Excel</button>'
      + '<button onclick="plAddSection()" style="background:#6366f1;color:white;border:none;border-radius:50px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">+ Add Section</button>'
      + '<button onclick="plCancelEdit()" style="background:#f1f5f9;color:#475569;border:none;border-radius:50px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">&#x2715; Cancel</button>'
      + '</div></div>'
      + '<div id="plToast" style="position:fixed;bottom:110px;right:28px;z-index:9999;background:#0f172a;color:white;padding:12px 20px;border-radius:10px;font-size:13px;opacity:0;transition:opacity 0.3s;pointer-events:none;max-width:300px;font-family:Segoe UI,system-ui,sans-serif;"></div>';
    document.body.appendChild(fab);
  }

  window.plToggleEdit = function() {
    editMode = !editMode;
    if (editMode) {
      savedHTML = document.documentElement.outerHTML;
      plEnableEditing();
    } else {
      plCancelEdit();
    }
  };

  function plEnableEditing() {
    document.getElementById("plIcon").innerHTML = "&#128065;";
    document.getElementById("plLabel").textContent = " En cours...";
    document.getElementById("plActions").style.display = "flex";
    document.getElementById("plToggle").style.background = "#f59e0b";

    var selectors = ".content-area p, .content-area h1, .content-area h2, .content-area h3, .content-area h4, .content-area li, .content-area td, .content-area th, .content-area b, .content-area span.text-block";
    var els = document.querySelectorAll(selectors);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.closest("#plEditor")) {
        el.setAttribute("contenteditable", "true");
        el.style.outline = "none";
        el.style.cursor = "text";
        el.addEventListener("focus", plMakeFocus(el));
        el.addEventListener("blur", plMakeBlur(el));
      }
    }

    var secs = document.querySelectorAll(".section-container");
    for (var j = 0; j < secs.length; j++) {
      var sec = secs[j];
      if (sec.querySelector(".pl-section-ctrl")) continue;
      var titleEl = sec.querySelector(".section-title");
      var titleText = titleEl ? titleEl.textContent.trim().slice(0, 40) : "Section";
      var ctrl = document.createElement("div");
      ctrl.className = "pl-section-ctrl";
      ctrl.style.cssText = "display:flex;gap:6px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed #e2e8f0;";
      ctrl.innerHTML = '<button onclick="plToggleSection(this)" data-hidden="false" style="padding:4px 12px;font-size:11px;border-radius:20px;border:1px solid #e2e8f0;background:#f8fafc;cursor:pointer;color:#64748b;font-weight:600;">&#128065; Hide</button>'
        + '<button onclick="plDeleteSection(this)" style="padding:4px 12px;font-size:11px;border-radius:20px;border:1px solid #fecaca;background:#fef2f2;cursor:pointer;color:#ef4444;font-weight:600;">&#x2715; Remove</button>'
        + '<span style="font-size:11px;color:#94a3b8;padding:4px 8px;font-style:italic;">' + titleText + '</span>';
      sec.insertBefore(ctrl, sec.firstChild);
    }
    plShowToast("Edit mode actif — cliquez sur n'importe quel texte");
  }

  function plMakeFocus(el) {
    return function() { el.style.background = "#fefce8"; el.style.borderRadius = "3px"; };
  }
  function plMakeBlur(el) {
    return function() { el.style.background = ""; el.style.borderRadius = ""; };
  }

  window.plToggleSection = function(btn) {
    var sec = btn.closest(".section-container");
    var isHidden = btn.dataset.hidden === "true";
    var children = sec.children;
    for (var i = 0; i < children.length; i++) {
      if (!children[i].classList.contains("pl-section-ctrl")) {
        children[i].style.opacity = isHidden ? "1" : "0.12";
        children[i].style.pointerEvents = isHidden ? "" : "none";
      }
    }
    btn.dataset.hidden = isHidden ? "false" : "true";
    btn.innerHTML = isHidden ? "&#128065; Hide" : "&#128683; Hidden";
    btn.style.background = isHidden ? "#f8fafc" : "#0f172a";
    btn.style.color = isHidden ? "#64748b" : "white";
  };

  window.plDeleteSection = function(btn) {
    var sec = btn.closest(".section-container");
    var titleEl = sec.querySelector(".section-title");
    var name = titleEl ? titleEl.textContent.trim() : "cette section";
    if (!confirm("Supprimer : " + name + " ?")) return;
    sec.remove();
    plShowToast("Section supprimee");
  };

  window.plAddSection = function() {
    var choice = prompt("Type de section :\n1 - Texte libre\n2 - Tableau financier\n3 - Risk flags\n4 - Lien Excel");
    if (!choice) return;
    var sec = document.createElement("div");
    sec.className = "section-container";
    if (choice.charAt(0) === "1") {
      sec.innerHTML = '<h2 class="section-title" contenteditable="true">Nouvelle Section</h2><p class="text-block" contenteditable="true" style="line-height:1.7;color:#334155;">Ecrivez votre contenu ici...</p>';
    } else if (choice.charAt(0) === "2") {
      sec.innerHTML = '<h2 class="section-title" contenteditable="true">Modele Financier</h2><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:0.9em;"><thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;"><th contenteditable="true" style="padding:10px;text-align:left;">Metric</th><th contenteditable="true" style="padding:10px;text-align:right;">Y1</th><th contenteditable="true" style="padding:10px;text-align:right;">Y2</th><th contenteditable="true" style="padding:10px;text-align:right;">Y3</th></tr></thead><tbody><tr><td contenteditable="true" style="padding:10px;font-weight:600;">Revenue (EUR M)</td><td contenteditable="true" style="padding:10px;text-align:right;">-</td><td contenteditable="true" style="padding:10px;text-align:right;">-</td><td contenteditable="true" style="padding:10px;text-align:right;">-</td></tr></tbody></table></div>';
    } else if (choice.charAt(0) === "3") {
      sec.innerHTML = '<h2 class="section-title" contenteditable="true">Risk Flags</h2><div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 15px;border-radius:0 4px 4px 0;font-size:0.85em;color:#92400e;" contenteditable="true">Nouveau risk flag</div><div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 15px;border-radius:0 4px 4px 0;font-size:0.95em;color:#14532d;margin-top:8px;" contenteditable="true">Nouveau signal positif</div>';
    } else if (choice.charAt(0) === "4") {
      var url = prompt("URL Excel / Google Sheets / Drive :");
      if (!url) return;
      var label = prompt("Nom du fichier :", "Financial Model") || "Financial Model";
      var date = new Date().toLocaleDateString("fr-FR");
      sec.innerHTML = '<h2 class="section-title">Modele Financier</h2><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;"><div><div style="font-weight:600;font-size:14px;" contenteditable="true">' + label + '</div><div style="color:#64748b;font-size:12px;margin-top:4px;">Ajoute le ' + date + '</div></div><a href="' + url + '" target="_blank" style="background:#0f172a;color:white;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Ouvrir</a></div>';
    }
    var ca = document.querySelector(".content-area");
    ca.appendChild(sec);
    plShowToast("Section ajoutee");
    sec.scrollIntoView({behavior: "smooth", block: "center"});
  };

  window.plAttachExcel = function() {
    var url = prompt("URL Excel / Google Sheets / Drive :");
    if (!url) return;
    var label = prompt("Nom du fichier :", "Financial Model") || "Financial Model";
    var date = new Date().toLocaleDateString("fr-FR");
    var block = document.getElementById("pl-excel-link");
    if (!block) {
      block = document.createElement("div");
      block.id = "pl-excel-link";
      block.className = "section-container";
    }
    block.innerHTML = '<h2 class="section-title">Modele Financier</h2><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;"><div><div style="font-weight:600;font-size:14px;" contenteditable="true">' + label + '</div><div style="color:#64748b;font-size:12px;margin-top:4px;">Ajoute le ' + date + '</div></div><a href="' + url + '" target="_blank" style="background:#0f172a;color:white;padding:8px 18px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Ouvrir</a></div>';
    if (!block.parentElement) document.querySelector(".content-area").appendChild(block);
    plShowToast("Lien Excel ajoute - sauvegardez pour confirmer");
    block.scrollIntoView({behavior: "smooth", block: "center"});
  };

  window.plSaveChanges = function() {
    plShowToast("Sauvegarde en cours...");
    var clone = document.documentElement.cloneNode(true);
    var ctrls = clone.querySelectorAll(".pl-section-ctrl");
    for (var i = 0; i < ctrls.length; i++) { ctrls[i].remove(); }
    var editables = clone.querySelectorAll("[contenteditable]");
    for (var j = 0; j < editables.length; j++) {
      editables[j].removeAttribute("contenteditable");
      editables[j].style.background = "";
      editables[j].style.borderRadius = "";
      editables[j].style.cursor = "";
    }
    var ed = clone.querySelector("#plEditor"); if (ed) ed.remove();
    var toast = clone.querySelector("#plToast"); if (toast) toast.remove();
    var updatedHTML = "<!DOCTYPE html>\n" + clone.outerHTML;
    fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({deal_id: DEAL_ID, updated_html: updatedHTML, updated_at: new Date().toISOString(), source: "live_editor"})
    }).then(function(res) {
      if (res.ok) { plShowToast("Sauvegarde et synchronise"); plExitEditMode(); }
      else { plShowToast("Erreur serveur - reessayez"); }
    }).catch(function() { plShowToast("Connexion echouee - verifiez le webhook"); });
  };

  window.plCancelEdit = function() {
    document.open();
    document.write(savedHTML);
    document.close();
  };

  function plExitEditMode() {
    editMode = false;
    var icon = document.getElementById("plIcon"); if (icon) icon.innerHTML = "&#9998;";
    var lbl = document.getElementById("plLabel"); if (lbl) lbl.textContent = " Edit Memo";
    var actions = document.getElementById("plActions"); if (actions) actions.style.display = "none";
    var toggle = document.getElementById("plToggle"); if (toggle) toggle.style.background = "#0f172a";
    var editables = document.querySelectorAll("[contenteditable]");
    for (var i = 0; i < editables.length; i++) {
      if (!editables[i].closest("#plEditor")) {
        editables[i].removeAttribute("contenteditable");
        editables[i].style.background = "";
        editables[i].style.borderRadius = "";
        editables[i].style.cursor = "";
      }
    }
    var ctrls = document.querySelectorAll(".pl-section-ctrl");
    for (var j = 0; j < ctrls.length; j++) { ctrls[j].remove(); }
  }

  function plShowToast(msg) {
    var t = document.getElementById("plToast");
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(window._plToastTimer);
    window._plToastTimer = setTimeout(function() { t.style.opacity = "0"; }, 3000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
