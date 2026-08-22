/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 도판 견본 · assets/art-demo.js
   ------------------------------------------------------------------
   ★ 메트로폴리탄 공개 API 에서 퍼블릭 도메인 도판을 받아 자리에 넣습니다.
   ★ 이것은 <b>시안용</b>입니다. 진짜 사이트에서는 화면에서 API 를 부르지
     않고, 날마다 받아 DB 에 쌓아 둔 것을 읽습니다. 그래야 빠르고,
     API 가 멈춰도 사이트가 멀쩡합니다.
   ▶ 작품DB 가 생기면 이 파일은 지웁니다.
   ══════════════════════════════════════════════════════════════════ */

/* ── 실제 도판 불러오기 ─────────────────────────────────────────
   ★ 메트로폴리탄 미술관 <b>공개 API</b>입니다. 인증키가 없어도 되고,
     퍼블릭 도메인 작품만 골라 받으므로 저작권 걱정이 없습니다.
   ★ 이 시안이 보여 주는 것이 곧 <b>오퍼스파인이 실제로 할 일</b>입니다.
     다만 진짜 사이트에서는 화면에서 그때그때 부르지 않고,
     <b>날마다 받아 DB에 쌓아 두고</b> 화면은 DB만 봅니다.

   ★★ 2026-08-21 · <b>너무 느렸습니다</b> (파트너 지적)
     처음에는 자리마다 검색을 따로 하고, 그것도 <b>하나씩 차례로</b>
     기다렸습니다. 11자리 × (검색 1 + 작품 최대 4) = 55번을 줄 세운
     셈입니다.
     ▶ 세 가지를 고쳤습니다
       ① 검색은 <b>딱 두 번</b>만 합니다 — 받은 번호를 자리들이 나눠 씁니다
       ② 작품 조회는 <b>한꺼번에</b> 보냅니다 (기다리지 않고 동시에)
       ③ <b>먼저 닿는 것부터</b> 화면에 넣습니다 — 다 모일 때까지
          기다리지 않습니다
   ★ 못 받으면 견본 그림이 그대로 남습니다 — 빈 네모가 남으면 안 됩니다. */
(function(){
  'use strict';
  var API = 'https://collectionapi.metmuseum.org/public/collection/v1';
  var slots = Array.prototype.slice.call(document.querySelectorAll('[data-art]'));
  if (!slots.length) return;
  slots.forEach(function(el){ el.classList.add('loading'); });

  function j(u){
    return fetch(u).then(function(r){ return r.ok ? r.json() : null; })
                   .catch(function(){ return null; });
  }
  function shuffle(a){
    for (var i=a.length-1;i>0;i--){ var k=Math.floor(Math.random()*(i+1));
      var t=a[i]; a[i]=a[k]; a[k]=t; }
    return a;
  }

  function capOf(o){
    return { who:o.artistDisplayName || o.culture || '작자 미상',
             title:o.title || '', when:o.objectDate || '', med:o.medium || '',
             hold:'The Metropolitan Museum of Art' };
  }

  function place(el, o){
    var src = o.primaryImageSmall || o.primaryImage;
    if (!src) { el.classList.remove('loading'); return; }
    var img = new Image();
    img.src = src;
    img.alt = (o.artistDisplayName ? o.artistDisplayName + ', ' : '') + (o.title || '작품');
    img.onload = function(){
      var svg = el.querySelector('svg');
      if (svg) svg.replaceWith(img); else el.appendChild(img);
      el.classList.remove('loading');

      var c = capOf(o), kind = el.getAttribute('data-art');
      if (kind === 'hero'){
        var box = el.parentNode.querySelector('.cap');
        if (box){
          box.querySelector('.cap-artist').textContent = c.who;
          box.querySelector('.cap-work').innerHTML =
            '<em>《' + c.title + '》</em>' + (c.when ? ', ' + c.when : '');
          box.querySelector('.cap-meta').textContent = c.med;
          box.querySelector('.cap-hold').textContent = c.hold;
        }
        var why = el.parentNode.querySelector('.why');
        if (why) why.textContent =
          '메트로폴리탄 미술관이 저작권 없이 공개한 소장품입니다. 쌓인 자료 가운데 날마다 한 점씩 골라 소개합니다.';
      }
      if (kind === 'mini'){
        var a = el.parentNode.querySelector('.a');
        var w = el.parentNode.querySelector('.w');
        if (a) a.textContent = c.who;
        if (w) w.textContent = '《' + c.title + '》';
      }
      if (kind === 'ar'){
        /* ★ 이름과 얼굴이 다릅니다. 숨기지 않고 밝힙니다 —
             見本임을 알 수 있어야 합니다. */
        var wrap = el.parentNode;
        if (!wrap.dataset.noted){
          wrap.dataset.noted = '1';
          var t = document.createElement('div');
          t.className = 'artcap';
          t.textContent = '초상 견본 · 메트로폴리탄';
          wrap.appendChild(t);
        }
      }
      if (kind === 'ex'){
        var v = el.parentNode.querySelector('.v');
        if (v && !v.dataset.kept){
          v.dataset.kept = '1';
          var n = document.createElement('div');
          n.className = 'artcap';
          n.textContent = '도판 ' + (c.who ? c.who + ', ' : '') + '《' + c.title + '》 · 메트로폴리탄';
          v.parentNode.appendChild(n);
        }
      }
    };
    img.onerror = function(){ el.classList.remove('loading'); };
  }

  /* ① 검색 <b>세 번</b> — 작품 풀 둘, 초상 풀 하나.
       ★ 2026-08-21 · 작가 자리에도 실제 그림을 넣습니다 (파트너 요청).
         작가 초상은 <b>초상화 풀</b>에서 따로 뽑습니다 — 산수나 도자가
         얼굴 자리에 들어가면 안 되기 때문입니다.
       ★ 다만 <b>이름과 얼굴은 맞지 않습니다.</b> 메트에 정선·김홍도의
         초상이 있을 리 없습니다. 실제 사이트에서는 위키데이터·커먼즈에서
         <b>그 작가의 진짜 초상</b>을 받아 채웁니다. */
  /* ★ 검색어만으로는 갈래가 안 잡힙니다 — 「portrait」로 찾으면 접시와
       서첩까지 물어 옵니다(파트너 화면에서 확인). 메트 API 의
       <b>medium</b> 으로 못박습니다. */
  var Q = [
    { key:'work',  q:'landscape', medium:'Paintings' },
    { key:'thing', q:'vase jar',  medium:'Ceramics'  },
    { key:'face',  q:'portrait',  medium:'Paintings' }
  ];
  function search(o){
    return j(API + '/search?q=' + encodeURIComponent(o.q)
             + '&medium=' + encodeURIComponent(o.medium)
             + '&hasImages=true&isPublicDomain=true');
  }

  Promise.all(Q.map(search)).then(function(res){
    function idsOf(r, n){
      return (r && r.objectIDs) ? shuffle(r.objectIDs.slice(0, 120)).slice(0, n) : [];
    }
    /* 얼굴 자리(작가·작가소개)와 그 밖을 나눕니다 */
    var arSlots = slots.filter(function(el){ return el.getAttribute('data-art') === 'ar'; });
    var etc     = slots.filter(function(el){ return el.getAttribute('data-art') !== 'ar'; });

    /* ★ 그림 없는 항목이 섞이므로 자리 수보다 넉넉히 부릅니다.
         자리가 늘면 이 수도 함께 늘어납니다 — 고정 숫자를 쓰지 않습니다. */
    var faceIds = idsOf(res[2], arSlots.length * 2);
    var workIds = idsOf(res[0], etc.length).concat(idsOf(res[1], Math.ceil(etc.length/2)));
    shuffle(workIds);

    if (!faceIds.length && !workIds.length){
      slots.forEach(function(el){ el.classList.remove('loading'); });
      return;
    }

    /* ② 한꺼번에 보내고 ③ 먼저 닿는 것부터 넣습니다 */
    function run(ids, free){
      ids.forEach(function(id){
        j(API + '/objects/' + id).then(function(o){
          if (!o || !(o.primaryImageSmall || o.primaryImage)) return;
          var el = free.shift();
          if (el) place(el, o);
        });
      });
    }
    run(faceIds, arSlots.slice());
    run(workIds, etc.slice());

    /* 6초 뒤에도 안 온 자리는 견본을 그대로 둡니다 */
    setTimeout(function(){
      slots.forEach(function(el){ el.classList.remove('loading'); });
    }, 6000);
  });
})();
