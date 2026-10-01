/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 회원 게시판 글쓰기 공용 처리 · assets/of-board-write.js
   2026-10-01
   ------------------------------------------------------------------
   7개 글쓰기 화면이 폼 모양만 다르고 저장 방식은 같아서, 그 부분만
   한 곳에 둡니다. 화면은 window.__bwCfg 를 미리 적어 두고 이 스크립트를
   불러오면 됩니다.

   __bwCfg = {
     board: 'hottopic',                 community_posts.board 값
     listPage: '/community/hottopic.html',
     viewPage: '/community/hottopic-view.html',
     fields: [                          DOM id → 표 칸
       { id:'bw-title', col:'title', required:true },
       { id:'bw-category', col:'category' },
       { id:'bw-body', col:'body' },
       …
     ]
   }
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (!window.__bwCfg) return;
  var cfg = window.__bwCfg;

  function boot() {
    var guard = document.getElementById('bwGuard');
    var form = document.getElementById('bwForm');
    var err = document.getElementById('bwErr');
    var submitBtn = document.getElementById('bwSubmit');
    var titleEl = document.getElementById('bwPageTitle');
    if (!form) return;

    var id = new URLSearchParams(location.search).get('id');
    var editing = !!id;

    function showGuard(html) {
      form.style.display = 'none';
      if (guard) { guard.style.display = ''; guard.innerHTML = html; }
    }

    function readFields() {
      var out = {};
      cfg.fields.forEach(function (f) {
        var el = document.getElementById(f.id);
        if (!el) return;
        out[f.col] = (el.value || '').trim() || null;
      });
      return out;
    }

    function fillFields(row) {
      cfg.fields.forEach(function (f) {
        var el = document.getElementById(f.id);
        if (el && row[f.col] != null) el.value = row[f.col];
      });
    }

    function checkRequired() {
      for (var i = 0; i < cfg.fields.length; i++) {
        var f = cfg.fields[i];
        if (!f.required) continue;
        var el = document.getElementById(f.id);
        if (!el || !(el.value || '').trim()) { if (el) el.focus(); return f.label || '필수 항목'; }
      }
      return null;
    }

    function ready() {
      if (!window.CM) return setTimeout(ready, 60);
      CM.session().then(function (ses) {
        if (!ses) {
          showGuard('로그인이 필요합니다. <a href="/account/login.html?next=' + encodeURIComponent(location.pathname + location.search) + '">로그인하기 →</a>');
          return;
        }
        CM.me().then(function (me) {
          if (!me || me.status !== 'approved') {
            showGuard('회원 승인 후 글을 쓰실 수 있습니다' + (me && me.status === 'pending' ? ' — 현재 승인 대기 중입니다.' : '.'));
            return;
          }
          if (!editing) { boot2(me, null); return; }
          OF.sb().then(function (sb) {
            sb.from('community_posts').select('*').eq('id', id).maybeSingle().then(function (r) {
              var row = r.data;
              if (!row) { showGuard('글을 찾을 수 없습니다.'); return; }
              if (row.author_id !== me.id && !me.is_admin) { showGuard('본인 글만 수정할 수 있습니다.'); return; }
              fillFields(row);
              if (titleEl) titleEl.textContent = '글 수정';
              boot2(me, row);
            });
          });
        });
      });
    }

    function boot2() {
      submitBtn.addEventListener('click', function () {
        err.textContent = '';
        var missing = checkRequired();
        if (missing) { err.textContent = missing + '을(를) 입력해 주세요.'; return; }
        var payload = readFields();
        OF.sb().then(function (sb) {
          var q = editing
            ? sb.from('community_posts').update(payload).eq('id', id).select('id').maybeSingle()
            : sb.from('community_posts').insert(Object.assign({ board: cfg.board }, payload)).select('id').maybeSingle();
          q.then(function (r) {
            if (r.error) { err.textContent = '저장 중 오류가 발생했습니다 — ' + r.error.message; return; }
            var newId = (r.data && r.data.id) || id;
            location.href = cfg.viewPage + '?id=' + encodeURIComponent(newId);
          });
        });
      });
    }

    ready();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
