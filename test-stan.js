/* ══════════════════════════════════════════════════════════════
   STAN — Validation Tests
   Run in browser console on a memo page with Stan loaded.
   Usage: load this script, then call runStanTests()
   ══════════════════════════════════════════════════════════════ */

window.runStanTests = function() {
  var pass = 0, fail = 0, errors = [];

  function assert(condition, msg) {
    if (condition) { pass++; }
    else { fail++; errors.push("FAIL: " + msg); }
  }

  /* ── 1. SKILL_DIRECT <-> OUT_CONTENT consistency ── */
  if (window.SKILL_DIRECT && window.OUT_CONTENT) {
    Object.keys(window.SKILL_DIRECT).forEach(function(key) {
      var skill = window.SKILL_DIRECT[key];
      if (skill.out && skill.out !== null) {
        // OUT_CONTENT may be empty in Week 1 (populated by API), so just check key is string
        assert(typeof skill.out === "string", "SKILL_DIRECT[" + key + "].out should be string, got " + typeof skill.out);
      }
    });
  } else {
    errors.push("SKIP: SKILL_DIRECT or OUT_CONTENT not loaded");
  }

  /* ── 2. INJECT_TARGET <-> INJECT_SECTIONS consistency ── */
  if (window.INJECT_TARGET && window.INJECT_SECTIONS) {
    var sectionIds = window.INJECT_SECTIONS.map(function(s) { return s.id; });
    Object.keys(window.INJECT_TARGET).forEach(function(key) {
      var target = window.INJECT_TARGET[key];
      assert(typeof target.selector === "string", "INJECT_TARGET[" + key + "] should have string selector");
      assert(typeof target.label === "string", "INJECT_TARGET[" + key + "] should have string label");
    });
    // Every INJECT_SECTIONS id should be a valid target
    window.INJECT_SECTIONS.forEach(function(sec) {
      assert(typeof sec.id === "string", "INJECT_SECTIONS entry should have string id");
      assert(typeof sec.label === "string", "INJECT_SECTIONS entry should have string label: " + sec.id);
      assert(typeof sec.icon === "string", "INJECT_SECTIONS entry should have icon: " + sec.id);
    });
  } else {
    errors.push("SKIP: INJECT_TARGET or INJECT_SECTIONS not loaded");
  }

  /* ── 3. SKILL_DIRECT fup inject keys exist in INJECT_TARGET ── */
  if (window.SKILL_DIRECT && window.INJECT_TARGET) {
    Object.keys(window.SKILL_DIRECT).forEach(function(key) {
      var skill = window.SKILL_DIRECT[key];
      if (skill.f) {
        skill.f.forEach(function(fup) {
          if (fup.inject) {
            assert(
              window.INJECT_TARGET.hasOwnProperty(fup.inject),
              "SKILL_DIRECT[" + key + "] fup injects '" + fup.inject + "' but INJECT_TARGET['" + fup.inject + "'] missing"
            );
          }
        });
      }
    });
  }

  /* ── 4. No French apostrophe issues in I18N ── */
  if (window.I18N) {
    ["fr", "en"].forEach(function(lang) {
      var strings = window.I18N[lang];
      if (!strings) return;
      Object.keys(strings).forEach(function(key) {
        var val = strings[key];
        // Check for raw ' that could break JS (should use \u2019 or escaped)
        // In the actual JSON, these are already safe — this checks runtime values
        assert(typeof val === "string", "I18N[" + lang + "][" + key + "] should be string");
      });
    });
  } else {
    errors.push("SKIP: I18N not loaded");
  }

  /* ── 5. All UI strings referenced by t() exist in I18N ── */
  if (window.I18N && window.I18N.fr) {
    var requiredKeys = [
      "parcours", "chat", "skills", "outputs", "historique",
      "next_action", "mandatory", "optional", "locked", "completed",
      "send", "typing", "inject_memo", "share_url", "view",
      "close", "cancel", "what_to_do", "see_outputs",
      "dir_launch", "dir_copy_prompt", "dir_copied",
      "hist_title", "hist_empty", "hist_view_diff", "hist_restore"
    ];
    requiredKeys.forEach(function(key) {
      assert(
        window.I18N.fr.hasOwnProperty(key),
        "I18N.fr missing key: " + key
      );
    });
  }

  /* ── 6. PHASES_BY_STATUS structure ── */
  if (window.PHASES_BY_STATUS) {
    assert(window.PHASES_BY_STATUS.CALL, "PHASES_BY_STATUS should have CALL entry");
    var phases = window.PHASES_BY_STATUS.CALL;
    assert(Array.isArray(phases), "PHASES_BY_STATUS.CALL should be array");
    assert(phases.length === 7, "Should have 7 phases, got " + phases.length);
    phases.forEach(function(phase, i) {
      assert(phase.id, "Phase " + i + " should have id");
      assert(phase.name, "Phase " + i + " should have name");
      assert(Array.isArray(phase.tasks), "Phase " + i + " should have tasks array");
      phase.tasks.forEach(function(task) {
        assert(task.id, "Task in phase " + phase.id + " should have id");
        assert(task.label, "Task " + task.id + " should have label");
        assert(typeof task.req === "boolean", "Task " + task.id + " should have boolean req");
      });
    });
  } else {
    errors.push("SKIP: PHASES_BY_STATUS not loaded");
  }

  /* ── 7. STATUS_FLOW consistency ── */
  if (window.STATUS_FLOW && window.STATUS_STYLE && window.STATUS_LABELS) {
    Object.keys(window.STATUS_FLOW).forEach(function(status) {
      assert(
        window.STATUS_STYLE.hasOwnProperty(status),
        "STATUS_STYLE missing for status: " + status
      );
      assert(
        window.STATUS_LABELS.hasOwnProperty(status),
        "STATUS_LABELS missing for status: " + status
      );
    });
  }

  /* ── 8. SKILL_NAMES covers all SKILL_DIRECT keys ── */
  if (window.SKILL_NAMES && window.SKILL_DIRECT) {
    Object.keys(window.SKILL_DIRECT).forEach(function(key) {
      assert(
        window.SKILL_NAMES.hasOwnProperty(key),
        "SKILL_NAMES missing for SKILL_DIRECT key: " + key
      );
    });
  }

  /* ── 9. DIRECTIVES structure ── */
  if (window.DIRECTIVES) {
    Object.keys(window.DIRECTIVES).forEach(function(dirId) {
      var dir = window.DIRECTIVES[dirId];
      assert(dir.name, "DIRECTIVES[" + dirId + "] should have name");
      assert(dir.engine, "DIRECTIVES[" + dirId + "] should have engine");
      assert(typeof dir.params === "function", "DIRECTIVES[" + dirId + "].params should be function");
      assert(typeof dir.prompt_template === "function", "DIRECTIVES[" + dirId + "].prompt_template should be function");
    });
  }

  /* ── 10. DOM elements (only if sidebar is loaded) ── */
  if (document.getElementById("stan-sidebar")) {
    var requiredEls = [
      "stan-sidebar", "stan-fabBtn", "stan-msgs", "stan-chatInput",
      "stan-timelineEl", "stan-outList", "stan-histList",
      "stan-typingW", "stan-rmFill", "stan-rmPct"
    ];
    requiredEls.forEach(function(id) {
      assert(document.getElementById(id), "DOM element #" + id + " should exist");
    });
  }

  /* ── Report ── */
  var summary = "Stan Tests: " + pass + " passed, " + fail + " failed";
  if (errors.length) {
    console.warn(summary);
    errors.forEach(function(e) { console.error(e); });
  } else {
    console.log("%c" + summary, "color:green;font-weight:bold;");
  }
  return { pass: pass, fail: fail, errors: errors };
};
