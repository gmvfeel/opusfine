/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 주소검색 · assets/addr.js · 2026-10-01
   ------------------------------------------------------------------
   오퍼스클램 assets/addr.js 를 참고해 포팅했습니다. 다음 주소(Daum
   Postcode) 팝업을 열어 우편번호·주소를 돌려받습니다.

   쓰는 법 — 버튼에 표시만 붙이면 됩니다.
     <button data-addr-search data-zip="#zip" data-addr1="#addr1" data-addr2="#addr2">주소검색</button>
   data-addr2 가 있으면 상세주소 입력칸에 자동으로 넘어갑니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var _libWait = null;
  function lib() {
    if (window.daum && window.daum.Postcode) return Promise.resolve(true);
    if (_libWait) return _libWait;
    _libWait = new Promise(function (done) {
      var s = document.createElement('script');
      s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      s.onload = function () { done(true); };
      s.onerror = function () { done(false); };
      document.head.appendChild(s);
    });
    return _libWait;
  }

  function open(btn) {
    var zipSel = btn.getAttribute('data-zip');
    var a1Sel = btn.getAttribute('data-addr1');
    var a2Sel = btn.getAttribute('data-addr2');
    lib().then(function (ok) {
      if (!ok) { alert('주소검색을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주십시오.'); return; }
      new window.daum.Postcode({
        oncomplete: function (data) {
          var addr = data.roadAddress || data.jibunAddress || data.address || '';
          var zipEl = zipSel && document.querySelector(zipSel);
          var a1El = a1Sel && document.querySelector(a1Sel);
          var a2El = a2Sel && document.querySelector(a2Sel);
          if (zipEl) zipEl.value = data.zonecode || '';
          if (a1El) a1El.value = addr;
          if (a2El) a2El.focus();
        },
      }).open();
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-addr-search]');
    if (!btn) return;
    e.preventDefault();
    open(btn);
  });
})();
