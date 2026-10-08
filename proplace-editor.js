/* Public memo compatibility entry point. The historical editor is retired;
 * this legacy URL only ensures Stan Parcours is available.
 * Memo sections, navigation and published text are never changed here. */
(function () {
  'use strict';
  var script = document.currentScript;
  var entry = new URL('proplace-chat-memo.js', script && script.src ? script.src : 'https://proplace-co.github.io/wargame/proplace-editor.js');

  function start() {
    var meta = document.querySelector('meta[name="stan-deal"]');
    if (!meta) return;
    var deal;
    try { deal = JSON.parse(meta.content); } catch (_) { return; }
    if (!deal || typeof (deal.airtable_record || deal.deal_id) !== 'string' || !(deal.airtable_record || deal.deal_id).trim()) return;

    // Remove only controls from the retired editor, including a cached copy.
    ['plEditor', 'plModal', 'plToast'].forEach(function (id) {
      var control = document.getElementById(id);
      if (control) control.remove();
    });
    if (window.StanJourney) return;

    // Most published memos already load Stan at the end of the body. Do not
    // inject it twice; legacy memos with only this URL get the same entry point.
    var present = Array.prototype.some.call(document.querySelectorAll('script[src]'), function (node) {
      try {
        var src = new URL(node.src, document.baseURI);
        return src.origin === entry.origin && src.pathname === entry.pathname;
      } catch (_) { return false; }
    });
    if (present) return;
    var stan = document.createElement('script');
    stan.src = entry.href;
    stan.async = true;
    document.head.appendChild(stan);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}());
