/* 작가 목록 — 캡션 방향 전환 (견주어 보시라고 둔 것) */

/* 캡션 방향 전환 — 견주어 보시라고 둔 것입니다.
   실제로는 하나를 골라 쓰고 이 단추는 뺍니다. */
(function(){
  var g=document.getElementById('grid'), sw=document.getElementById('capSw');
  if(!g||!sw) return;
  sw.querySelectorAll('button').forEach(function(b){
    b.addEventListener('click', function(){
      sw.querySelectorAll('button').forEach(function(x){ x.classList.remove('on'); });
      b.classList.add('on');
      g.classList.toggle('cap-v', b.getAttribute('data-cap')==='v');
    });
  });
})();
