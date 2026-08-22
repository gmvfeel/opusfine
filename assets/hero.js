/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 대문 히어로 · assets/hero.js
   ★ 지금은 견본 넷이 돕니다. 표가 생기면 exhibitions 에서 받아
     채웁니다 — SLIDES 배열만 갈아 끼우면 됩니다.
   ══════════════════════════════════════════════════════════════════ */

/* 히어로 넘기기 — 실제로는 exhibitions 표에서 받아 채웁니다 */
(function(){
  'use strict';
  var SLIDES = [
    { eb:'국립현대미술관 서울', t:'색면과 여백<br><b>한국 추상 60년</b>',
      s:'전후 세대부터 오늘까지, 한국 추상회화가 지나온 길을 한자리에서 봅니다. 소장품 140여 점과 미공개 자료를 함께 냅니다.',
      m:['<b>2026.08.02 — 11.16</b>','서울관 3·4전시실','참여작가 <b>38명</b>'] },
    { eb:'간송미술관', t:'풍속,<br><b>사람을 그리다</b>',
      s:'조선 후기 풍속화가 담아낸 저잣거리와 놀이, 그 안의 사람들. 김홍도와 신윤복의 화첩을 나란히 펼칩니다.',
      m:['<b>2026.07.19 — 10.05</b>','성북동 본관','출품작 <b>62점</b>'] },
    { eb:'서울시립미술관 서소문본관', t:'밤의 화가들<br><b>어둠을 그린 사람들</b>',
      s:'해가 진 뒤의 빛을 좇은 화가들. 램프와 달빛, 도시의 야경이 회화 안으로 들어온 백 년을 따라갑니다.',
      m:['<b>2026.06.28 — 09.28</b>','1층 전관','참여작가 <b>24명</b>'] },
    { eb:'OPUSFINE', t:'작품과 사람을<br><b>제대로 기록하는 곳</b>',
      s:'작가와 작품, 전시와 공간, 학교와 기관 — 흩어져 있던 미술 자료를 한자리에 모읍니다. 부족한 곳은 미술계 회원들이 함께 채웁니다.',
      m:['작품 <b>184,206</b>','작가 <b>31,470</b>','전시 기록 <b>12,885</b>'] }
  ];
  var dots=document.querySelectorAll('#dots i');
  var eb=document.getElementById('h-eb'), ti=document.getElementById('h-t');
  var su=document.getElementById('h-s'), me=document.getElementById('h-m');
  var box=document.getElementById('hslide');
  var si=0, stop=false;
  var slow=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  box.style.transition='opacity .28s ease';
  function paint(n){
    var d=SLIDES[n];
    box.style.opacity='0';
    setTimeout(function(){
      eb.textContent=d.eb; ti.innerHTML=d.t; su.textContent=d.s;
      me.innerHTML=d.m.map(function(x){return '<span>'+x+'</span>';}).join('<i>·</i>');
      box.style.opacity='1';
    }, slow?0:280);
    dots.forEach(function(el,i){ el.classList.toggle('on', i===n); });
  }
  function go(n){ si=(n+SLIDES.length)%SLIDES.length; paint(si); }

  if(!slow){
    setInterval(function(){
      if(stop) return;
      go(si+1);
    }, 6800);
  }
  dots.forEach(function(el,i){
    el.addEventListener('click', function(){ go(i); });
    el.addEventListener('keydown', function(e){
      if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(i); }
    });
  });
  var hero=document.querySelector('.hero');
  hero.addEventListener('mouseenter', function(){ stop=true; });
  hero.addEventListener('mouseleave', function(){ stop=false; });
  hero.addEventListener('focusin', function(){ stop=true; });
  hero.addEventListener('focusout', function(){ stop=false; });
})();
