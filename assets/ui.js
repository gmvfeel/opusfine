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
  function apply(t){
    if(t==='dark') document.documentElement.setAttribute('data-theme','dark');
    else document.documentElement.removeAttribute('data-theme');
  }
  var saved=null;
  try{ saved=localStorage.getItem(KEY); }catch(e){}
  if(saved) apply(saved);
  btn.addEventListener('click', function(){
    var now = document.documentElement.getAttribute('data-theme')==='dark' ? '' : 'dark';
    apply(now);
    try{ localStorage.setItem(KEY, now); }catch(e){}
  });
}

/* ★ 머리는 include.js 가 나중에 끼웁니다. 그 전에 붙으려 하면
     아직 없는 단추를 찾게 됩니다 — 끼워졌다는 알림을 기다립니다. */
document.addEventListener('oc:included', ocUiBoot);

/* 밝기는 <b>끼우기 전에</b> 미리 적용합니다.
   기다리면 화면이 흰색으로 한 번 번쩍입니다. */
(function(){
  try{
    var t=localStorage.getItem('of-theme');
    if(t==='dark') document.documentElement.setAttribute('data-theme','dark');
  }catch(e){}
})();
