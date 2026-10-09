/* Public memo compatibility entry point. The historical editor is retired;
 * this legacy URL only ensures Stan Parcours is available.
 * Memo sections, navigation and published text are never changed here. */
(function () {
  'use strict';
  var script = document.currentScript;
  var entry = new URL('proplace-chat-memo.js', script && script.src ? script.src : 'https://proplace-co.github.io/wargame/proplace-editor.js');

  // Visual compatibility for native image dialogs in published memos.
  // No memo content, structure, navigation or audit payload is rewritten.
  function centerMemoImageDialog() {
    var dialog = document.getElementById('memo-image-dialog');
    if (!dialog || document.getElementById('memo-image-center-style')) return;
    var style = document.createElement('style');
    style.id = 'memo-image-center-style';
    style.textContent = "#memo-image-dialog{position:fixed;inset:0;transform:none;margin:0;width:100vw;height:100vh;height:100dvh;max-width:none;max-height:none;box-sizing:border-box;padding:64px 24px;border:0;border-radius:0;background:transparent;overflow:hidden;color:#10263b}\n#memo-image-dialog[open]{display:grid;place-items:center}\n#memo-image-dialog::backdrop{background:rgba(15,29,51,.88)}\n#memo-image-dialog form{position:absolute;top:16px;right:24px;margin:0;text-align:right}\n#memo-image-dialog button{background:#fff;color:#10263b;border:1px solid #cbd5e1;border-radius:20px;padding:7px 14px;font:600 13px system-ui;cursor:pointer}\n#memo-image-dialog img{grid-area:1/1;display:block;max-width:100%;max-height:calc(100vh - 128px);max-height:calc(100dvh - 128px);width:auto;height:auto;object-fit:contain;margin:0;background:#fff;border-radius:8px}\n#memo-image-dialog p{position:absolute;bottom:16px;left:24px;right:24px;max-height:40px;overflow:auto;margin:0;font:13px/1.4 system-ui;text-align:center;color:#fff}";
    document.head.appendChild(style);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog && dialog.open) dialog.close();
    });
  }

  function start() {
    centerMemoImageDialog();
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
