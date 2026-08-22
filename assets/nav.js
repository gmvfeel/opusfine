/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 대메뉴 하위 · assets/nav.js
   ------------------------------------------------------------------
   ★ 아카이브 큰 판에 <b>쌓인 수</b>와 <b>오늘의 소장품</b>을 채웁니다.
     화면에 적어 두면 자료가 늘 때마다 사람이 고쳐야 합니다.

   ★ 한 번만 부릅니다. 마우스를 올릴 때마다 물으면 낭비입니다.

   ★ 못 받으면 「···」 이 그대로 남습니다. 오류를 화면에 내보이지
     않습니다 — 메뉴는 조용해야 하는 자리입니다.

   ★ 머리는 include.js 가 나중에 끼웁니다. 그 알림을 기다립니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var TABLE = { artists: 'artists', artworks: 'artworks' };
  var done = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var head = function () {
    return { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  };

  async function countOf(t) {
    var r = await fetch(OF.SB_URL + '/rest/v1/' + t + '?select=id&hidden=not.is.true&limit=1', {
      method: 'HEAD', headers: Object.assign(head(), { Prefer: 'count=exact' })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var m = /\/(\d+)$/.exec(r.headers.get('content-range') || '');
    return m ? Number(m[1]) : null;
  }

  /* ── 오늘의 소장품 ──
     ★ 날마다 같은 작품이 나오게 <b>날짜로 고릅니다.</b> 새로 고칠 때마다
       바뀌면 「오늘의」가 아닙니다. */
  async function pick() {
    var box = document.getElementById('navPick');
    if (!box) return;
    try {
      var r = await fetch(
        OF.SB_URL + '/rest/v1/artworks?select=id,title,year_text,medium,holder,image_small,image_url'
        + '&hidden=not.is.true&rights=eq.public&image_small=not.is.null'
        + '&order=quality.desc,id.asc&limit=60',
        { headers: head() });
      if (!r.ok) return;
      var rows = await r.json();
      if (!rows.length) return;

      var d = new Date();
      var key = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      var w = rows[key % rows.length];

      var a = box.querySelector('.pk');
      if (!a) return;
      a.href = '/db/work-view.html?id=' + w.id;
      var img = OF.img(w.image_small || w.image_url);
      box.querySelector('.pk-img').innerHTML = img
        ? '<img src="' + esc(img) + '" alt="' + esc(w.title) + '" referrerpolicy="no-referrer" loading="lazy">' : '';
      box.querySelector('.pk-t').textContent = '《' + w.title + '》';
      box.querySelector('.pk-m').textContent =
        [w.year_text, w.holder].filter(Boolean).join(' · ');
    } catch (e) { /* 조용히 */ }
  }

  async function run() {
    if (done) return;
    if (!window.OF || !OF.SB_URL) return;
    done = true;

    var slots = document.querySelectorAll('[data-nav-count]');
    for (var i = 0; i < slots.length; i++) {
      var el = slots[i], t = TABLE[el.getAttribute('data-nav-count')];
      if (!t) continue;
      try {
        var n = await countOf(t);
        if (n != null) el.textContent = n.toLocaleString();
      } catch (e) { /* 조용히 */ }
    }
    await pick();
  }

  document.addEventListener('oc:included', run);
  /* 머리를 끼우지 않는 화면에서도 돌게 해 둡니다 */
  if (document.readyState !== 'loading') setTimeout(run, 1200);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(run, 1200); });
})();
