/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 조각 끼우기 · assets/include.js
   ------------------------------------------------------------------
   머리와 꼬리를 화면마다 적지 않고 <b>partials/ 에서 받아 끼웁니다.</b>
   고칠 자리가 하나로 남습니다 — 오퍼스클램과 같은 방식입니다.

   쓰는 법
     <div data-include="/partials/header.html"></div>
     <div data-include="/partials/footer.html"></div>

   ★ 끼운 뒤에 <b>oc:included</b> 를 알립니다. 머리 안의 단추를 다루는
     ui.js 는 그때까지 기다렸다가 붙습니다. 먼저 붙으려 하면 아직
     없는 것을 찾게 됩니다.
   ★ 지금 보고 있는 화면의 메뉴에 표시를 답니다(.on). 주소를 보고
     스스로 판단하므로 화면마다 적어 둘 필요가 없습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* 어느 메뉴에 표시를 달지 — 주소 앞머리로 가립니다 */
  var MARK = [
    { pre: '/db/artist',  menu: '작가' },
    { pre: '/db/work',    menu: '아카이브' },
    { pre: '/db/',        menu: '아카이브' },
    { pre: '/exhibition', menu: '전시' },
    { pre: '/call',       menu: '공모·지원' },
    { pre: '/community',  menu: '커뮤니티' },
    { pre: '/market',     menu: '미술시장' },
    { pre: '/recruit',    menu: '리쿠르트' }
  ];

  function markMenu(root) {
    var path = location.pathname;
    var hit = null;
    for (var i = 0; i < MARK.length; i++) {
      if (path.indexOf(MARK[i].pre) === 0) { hit = MARK[i].menu; break; }
    }
    if (!hit) return;
    /* ★ 하위 메뉴가 생겼습니다. 대메뉴 글자만 골라야 합니다 —
         `header nav a` 로 하면 하위 항목까지 표시가 붙습니다. */
    var links = root.querySelectorAll('header nav > .mi > a');
    for (var k = 0; k < links.length; k++) {
      if (String(links[k].textContent).trim() === hit) links[k].classList.add('on');
    }
  }

  function fill(el) {
    var url = el.getAttribute('data-include');
    if (!url) return Promise.resolve();
    return fetch(url)
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (html) {
        if (!html) return;
        /* ★ outerHTML 로 <b>자기 자신을 갈아 끼웁니다.</b>
             innerHTML 로 채우면 빈 div 가 하나 남아 자리 계산이 어긋납니다. */
        var box = document.createElement('div');
        box.innerHTML = html;
        var frag = document.createDocumentFragment();
        while (box.firstChild) frag.appendChild(box.firstChild);
        el.parentNode.replaceChild(frag, el);
      })
      .catch(function () { /* 못 받아도 화면 나머지는 나와야 합니다 */ });
  }

  function run() {
    var slots = Array.prototype.slice.call(document.querySelectorAll('[data-include]'));
    Promise.all(slots.map(fill)).then(function () {
      markMenu(document);
      document.dispatchEvent(new CustomEvent('oc:included'));
    });
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', run);
  else run();
})();
