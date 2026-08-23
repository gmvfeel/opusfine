/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 머리 도구 · assets/ui.js
   전체 메뉴 · 밝게/어둡게. 모든 화면이 함께 씁니다.
   ══════════════════════════════════════════════════════════════════ */

/* ── 머리 도구 ─────────────────────────────────────────────────
   ★ 전체 메뉴 · 밝게/어둡게. 실제 사이트에서는 assets/app.js 한 곳에
     두고 모든 화면이 같은 것을 씁니다.
   ★ 고른 밝기는 기억해 둡니다 — 화면을 옮길 때마다 되돌아가면 안 됩니다.
     (시안이라 localStorage 를 씁니다) */
function ocUiBoot(){
  'use strict';
  var fm=document.getElementById('fm');
  if(!fm) return;
  var open=document.getElementById('fmBtn');
  var close=document.getElementById('fmClose');
  function set(on){
    fm.classList.toggle('on', on);
    open.setAttribute('aria-expanded', on?'true':'false');
    document.body.style.overflow = on ? 'hidden' : '';
  }
  open.addEventListener('click', function(){ set(true); });
  close.addEventListener('click', function(){ set(false); });
  fm.addEventListener('click', function(e){ if(e.target===fm) set(false); });
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape' && fm.classList.contains('on')) set(false);
  });

  var btn=document.getElementById('themeBtn');
  var KEY='of-theme';

  /* ★ 글자는 <b>누르면 갈 곳</b>을 적습니다.
       지금 밝으면 「Dark」 — 누르면 어두워진다는 뜻입니다.
       지금 상태를 적으면 「밝음」인데 누르라는 건지 아닌지 헷갈립니다. */
  function label(){
    var tx=document.getElementById('themeTx');
    if(!tx) return;
    var dark = document.documentElement.getAttribute('data-theme')==='dark';
    tx.textContent = dark ? 'Light' : 'Dark';
    if(btn) btn.setAttribute('aria-label', dark ? '밝게 보기' : '어둡게 보기');
  }
  function apply(t){
    if(t==='dark') document.documentElement.setAttribute('data-theme','dark');
    else document.documentElement.removeAttribute('data-theme');
    label();
  }
  var saved=null;
  try{ saved=localStorage.getItem(KEY); }catch(e){}
  apply(saved==='dark' ? 'dark' : '');
  btn.addEventListener('click', function(){
    var now = document.documentElement.getAttribute('data-theme')==='dark' ? '' : 'dark';
    apply(now);
    try{ localStorage.setItem(KEY, now); }catch(e){}
  });
}

/* ── 고르는 상자 ─────────────────────────────────────────────────
   ★ 2026-08-23 · 브라우저 기본 <select> 를 우리 목록으로 갈아 끼웁니다
     (파트너 지적). 펼치면 <b>파란 칠과 검정 테두리</b>가 나왔습니다 —
     그 그림은 운영체제가 그리는 것이라 CSS 가 닿지 못합니다.
   ★ 원래 <select> 를 <b>지우지 않고 감춰 둡니다.</b>
       · 자바스크립트가 막히면 그것이 그대로 나와 여전히 고를 수 있습니다
       · 고른 값은 언제나 그 <select> 에 담깁니다. 나중에 진짜
         언어 전환을 붙일 때 <b>여기만 보면</b> 됩니다
   ★ 열쇠판으로도 다 됩니다 — ↑↓ 로 옮기고, Enter 로 고르고,
     Esc 로 닫습니다. 마우스가 없는 사람도 씁니다.
   ★ 두 번 붙지 않게 표시를 답니다(dataset.ofsel). 조각이 다시
     끼워져도 목록이 겹쳐 생기지 않습니다. */
function ocSelectBoot(){
  'use strict';
  var wraps = document.querySelectorAll('.lang, .ft-family');
  Array.prototype.forEach.call(wraps, function(wrap){
    if (wrap.dataset.ofsel) return;
    var sel = wrap.querySelector('select');
    if (!sel) return;
    wrap.dataset.ofsel = '1';
    wrap.classList.add('ofsel');

    var opts = Array.prototype.slice.call(sel.options);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ofsel-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
    btn.textContent = opts[sel.selectedIndex] ? opts[sel.selectedIndex].text : '';

    var list = document.createElement('ul');
    list.className = 'ofsel-list down';
    list.setAttribute('role', 'listbox');

    var items = opts.map(function(op, i){
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', i === sel.selectedIndex ? 'true' : 'false');
      b.textContent = op.text;
      b.addEventListener('click', function(){ pick(i); });
      li.appendChild(b);
      list.appendChild(li);
      return b;
    });

    wrap.appendChild(btn);
    wrap.appendChild(list);

    function pick(i){
      sel.selectedIndex = i;
      btn.textContent = opts[i].text;
      items.forEach(function(b, k){
        b.setAttribute('aria-selected', k === i ? 'true' : 'false');
      });
      /* ★ 감춰 둔 <select> 에게도 알립니다 — 나중에 붙일 것이
           이 알림만 들으면 되도록 */
      sel.dispatchEvent(new Event('change', { bubbles:true }));
      set(false);
      btn.focus();
    }

    function set(on){
      /* ★ 펼칠 자리를 <b>열 때마다</b> 잽니다. 창 크기나 스크롤이
           달라지므로 미리 정해 두면 틀립니다. */
      if (on){
        var r = wrap.getBoundingClientRect();
        var need = opts.length * 28 + 12;
        var down = (window.innerHeight - r.bottom) > need + 12;
        list.className = 'ofsel-list ' + (down ? 'down' : 'up');
      }
      wrap.classList.toggle('on', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    }

    btn.addEventListener('click', function(e){
      e.stopPropagation();
      set(!wrap.classList.contains('on'));
    });

    btn.addEventListener('keydown', function(e){
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
        e.preventDefault(); set(true);
        (items[sel.selectedIndex] || items[0]).focus();
      }
    });

    list.addEventListener('keydown', function(e){
      var at = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown'){ e.preventDefault(); (items[at+1] || items[0]).focus(); }
      else if (e.key === 'ArrowUp'){ e.preventDefault(); (items[at-1] || items[items.length-1]).focus(); }
      else if (e.key === 'Escape'){ e.preventDefault(); set(false); btn.focus(); }
      else if (e.key === 'Tab'){ set(false); }
    });

    /* 바깥을 누르면 닫습니다 */
    document.addEventListener('click', function(e){
      if (!wrap.contains(e.target)) set(false);
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && wrap.classList.contains('on')){ set(false); btn.focus(); }
    });
  });
}

/* ★ 머리는 include.js 가 나중에 끼웁니다. 그 전에 붙으려 하면
     아직 없는 단추를 찾게 됩니다 — 끼워졌다는 알림을 기다립니다. */
document.addEventListener('oc:included', ocUiBoot);
document.addEventListener('oc:included', ocSelectBoot);

/* 밝기는 <b>끼우기 전에</b> 미리 적용합니다.
   기다리면 화면이 흰색으로 한 번 번쩍입니다. */
(function(){
  try{
    var t=localStorage.getItem('of-theme');
    if(t==='dark') document.documentElement.setAttribute('data-theme','dark');
  }catch(e){}
})();
