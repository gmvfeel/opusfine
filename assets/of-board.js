/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 회원 게시판 공용 엔진 · assets/of-board.js · 2026-10-01
   ------------------------------------------------------------------
   오퍼스클램의 OCBoard(assets/board.js, 2000여 줄)를 그대로 옮기지
   않았습니다. 그 파일은 악보·영상·공연정보 등 음악 전용 게시판 열 곳이
   10년 가까이 쌓아 온 기능(지역·시대·날짜 탭, 영상 플레이어, 회원전용
   파일 등)을 한 파일에 담고 있어, 지금 필요한 미술 커뮤니티 게시판
   7종(핫토픽·전시기록·작업공유·Q&A·입시·뉴스·자료실)에는 대부분
   맞지 않습니다.

   대신 오퍼스파인의 기존 목록 화면들(assets/paper-list.js 등)이 쓰는
   방식 — PER 개씩 「더 보기」로 받기, hidden=not.is.true 로 거르기 —
   을 그대로 따라 새로 가볍게 짰습니다. 표도 게시판마다 따로 두지 않고
   community_posts 하나를 board 칸으로 나눠 씁니다(DB 쪽 설명 참고).

   쓰는 법
     목록   OFBoard.list({ board:'hottopic', viewPage:'hottopic-view.html',
                           writePage:'hottopic-write.html',
                           categories:['전체','잡담','정보공유'] })
     상세   OFBoard.view({ board:'hottopic', listPage:'hottopic.html',
                           writePage:'hottopic-write.html' })
   ══════════════════════════════════════════════════════════════════ */
window.OFBoard = (function () {
  'use strict';
  if (!window.OF || !OF.SB_URL) return { list: function () {}, view: function () {} };

  var H = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  var PER = 20;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nl2br(s) { return esc(s).replace(/\r\n|\r|\n/g, '<br>'); }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return esc(String(iso).slice(0, 10));
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
  }
  function previewText(s, n) {
    var t = (s == null ? '' : String(s)).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    n = n || 110;
    return esc(t.length > n ? t.slice(0, n) + '…' : t);
  }
  function headers(withCount) {
    var h = { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
    if (withCount) h.Prefer = 'count=exact';
    return h;
  }
  function api(path, opt) {
    return fetch(OF.SB_URL + '/rest/v1/' + path, Object.assign({ headers: H }, opt || {}))
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }

  /* 글쓴이 id 목록을 받아 표시 이름을 모읍니다(community_authors_public) */
  function fetchAuthors(ids) {
    var uniq = ids.filter(function (v, i) { return v && ids.indexOf(v) === i; });
    if (!uniq.length) return Promise.resolve({});
    return api('community_authors_public?select=id,display_name,member_type&id=in.(' + uniq.join(',') + ')')
      .then(function (rows) {
        var m = {};
        rows.forEach(function (r) { m[r.id] = r; });
        return m;
      })['catch'](function () { return {}; });
  }

  function noteHtml(msg) { return '<div class="bb-empty">' + msg + '</div>'; }

  function skeleton(n) {
    var h = '';
    for (var i = 0; i < n; i++) h += '<div class="bb-skel"></div>';
    return h;
  }

  /* ── 글쓰기 버튼/안내 — 로그인·승인 상태에 따라 자리를 채웁니다 ── */
  function mountWriteGate(el, writePage, extraQS) {
    if (!el) return;
    function paint(row) {
      if (!row) {
        el.innerHTML = '<a class="btn sm" href="/account/login.html?next=' + encodeURIComponent(location.pathname + location.search) + '">로그인 후 글쓰기</a>';
      } else if (row.status !== 'approved') {
        el.innerHTML = '<span class="bb-pending">회원 승인 후 글을 쓰실 수 있습니다 (' +
          (row.status === 'pending' ? '승인 대기 중' : row.status === 'rejected' ? '승인 거부됨' : '이용 불가') + ')</span>';
      } else {
        el.innerHTML = '<a class="btn sm" href="' + writePage + (extraQS || '') + '">글쓰기</a>';
      }
    }
    if (!window.CM) { paint(null); return; }
    CM.session().then(function (ses) {
      if (!ses) { paint(null); return; }
      CM.me().then(function (row) { paint(row && row.status !== 'withdrawn' ? row : null); });
    });
  }

  /* ============================ 목록 ============================ */
  function list(cfg) {
    var listEl = document.querySelector('.bb-list');
    var cntEl = document.querySelector('.bb-cnt');
    var moreBox = document.querySelector('.bb-more');
    var moreBtn = moreBox ? moreBox.querySelector('button') : null;
    var qEl = document.querySelector('.bb-q');
    var catsEl = document.querySelector('.bb-cats');
    var wgate = document.querySelector('.bb-writegate');
    if (!listEl) return;

    var page = 0, total = null, busy = false, q = '', cat = '';
    var searchCols = cfg.searchCols || ['title', 'body'];

    mountWriteGate(wgate, cfg.writePage);

    if (catsEl && cfg.categories && cfg.categories.length) {
      catsEl.innerHTML = cfg.categories.map(function (c, i) {
        return '<button type="button" class="bb-chip' + (i === 0 ? ' on' : '') + '" data-cat="' + esc(i === 0 ? '' : c) + '">' + esc(c) + '</button>';
      }).join('');
      catsEl.addEventListener('click', function (e) {
        var b = e.target.closest('.bb-chip'); if (!b) return;
        cat = b.getAttribute('data-cat') || '';
        catsEl.querySelectorAll('.bb-chip').forEach(function (x) { x.classList.toggle('on', x === b); });
        load(true);
      });
    }

    if (qEl) {
      var t;
      qEl.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () { q = qEl.value.trim(); load(true); }, 280);
      });
    }
    if (moreBtn) moreBtn.addEventListener('click', function () { load(false); });

    function query() {
      var p = [];
      p.push('select=id,title,category,thumb_url,file_name,link_url,author_id,view_count,is_pinned,created_at,body,event_date,location,organizer');
      p.push('board=eq.' + encodeURIComponent(cfg.board));
      p.push('hidden=eq.false');
      if (cat) p.push('category=eq.' + encodeURIComponent(cat));
      if (q) {
        var w = '*' + q.replace(/[*(),]/g, '') + '*';
        p.push('or=(' + searchCols.map(function (c) { return c + '.ilike.' + w; }).join(',') + ')');
      }
      p.push('order=is_pinned.desc,created_at.desc');
      return OF.SB_URL + '/rest/v1/community_posts?' + p.join('&');
    }

    function fetchPage(n) {
      var from = n * PER, to = from + PER - 1;
      return fetch(query(), { headers: Object.assign(headers(n === 0), { Range: from + '-' + to, 'Range-Unit': 'items' }) })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          if (n === 0) {
            var cr = r.headers.get('content-range') || '';
            var m = cr.match(/\/(\d+)$/);
            total = m ? Number(m[1]) : null;
          }
          return r.json();
        });
    }

    function row(p, authors) {
      var vp = cfg.viewPage + '?id=' + encodeURIComponent(p.id);
      var au = authors[p.author_id];
      var auName = au ? au.display_name : '탈퇴회원';
      var th = p.thumb_url ? '<span class="bb-row-thumb"><img src="' + esc(p.thumb_url) + '" alt="" loading="lazy" onerror="this.closest(\'.bb-row-thumb\').remove()"></span>' : '';
      var dateLabel = cfg.dateLabel || '';
      var evt = (p.event_date && dateLabel) ? '<span class="bb-tag evt">' + esc(dateLabel) + ' ' + fmtDate(p.event_date) + '</span>' : '';
      var orgLoc = [p.organizer, p.location].filter(Boolean).map(esc).join(' · ');
      return '<a class="bb-row' + (p.is_pinned ? ' pin' : '') + (th ? ' has-thumb' : '') + '" href="' + vp + '">'
        + th
        + '<span class="bb-row-main">'
        +   '<span class="bb-row-head">'
        +     (p.is_pinned ? '<span class="bb-tag pin">고정</span>' : '')
        +     (p.category ? '<span class="bb-tag">' + esc(p.category) + '</span>' : '')
        +     evt
        +     '<span class="bb-row-by">' + esc(auName) + '</span>'
        +     '<span class="bb-row-date">' + fmtDate(p.created_at) + '</span>'
        +   '</span>'
        +   '<span class="bb-row-title">' + esc(p.title || '') + (p.link_url ? ' <i class="bb-ext">↗</i>' : '') + (p.file_name ? ' <i class="bb-file">📎</i>' : '') + '</span>'
        +   (orgLoc ? '<span class="bb-row-prev">' + orgLoc + '</span>' : (p.body ? '<span class="bb-row-prev">' + previewText(p.body) + '</span>' : ''))
        + '</span>'
        + '<span class="bb-row-views">조회 ' + (p.view_count || 0) + '</span>'
        + '</a>';
    }

    function load(reset) {
      if (busy) return;
      busy = true;
      if (reset) { page = 0; listEl.innerHTML = skeleton(5); }
      fetchPage(page).then(function (rows) {
        return fetchAuthors(rows.map(function (r) { return r.author_id; })).then(function (authors) {
          if (page === 0) listEl.innerHTML = '';
          if (!rows.length && page === 0) {
            listEl.innerHTML = noteHtml('아직 올라온 글이 없습니다. 첫 글을 남겨 보세요.');
            if (moreBox) moreBox.hidden = true;
            if (cntEl) cntEl.textContent = '0건';
            busy = false;
            return;
          }
          listEl.insertAdjacentHTML('beforeend', rows.map(function (r) { return row(r, authors); }).join(''));
          page++;
          if (total != null && cntEl) cntEl.innerHTML = '<b>' + total.toLocaleString() + '</b>건';
          if (moreBox) moreBox.hidden = rows.length === 0 || (total != null && page * PER >= total);
          busy = false;
        });
      })['catch'](function (e) {
        listEl.innerHTML = noteHtml('목록을 불러오지 못했습니다 — ' + esc(String(e.message || e).slice(0, 160)));
        if (moreBox) moreBox.hidden = true;
        busy = false;
      });
    }

    load(true);
  }

  /* ============================ 상세 ============================ */
  function view(cfg) {
    var box = document.querySelector('.bb-view');
    var id = new URLSearchParams(location.search).get('id');
    if (!box) return;
    if (!id) { box.innerHTML = noteHtml('잘못된 접근입니다.'); return; }

    api('community_posts?select=*&id=eq.' + encodeURIComponent(id) + '&limit=1')
      .then(function (rows) {
        var o = rows && rows[0];
        if (!o) { box.innerHTML = noteHtml('글을 찾을 수 없거나 삭제되었습니다.'); return; }
        document.title = (o.title || cfg.label || '게시판') + ' · OPUSFINE';

        return fetchAuthors([o.author_id]).then(function (authors) {
          var au = authors[o.author_id];
          var auName = au ? au.display_name : '탈퇴회원';
          var thumb = o.thumb_url ? '<img class="bb-thumb" src="' + esc(o.thumb_url) + '" alt="" loading="lazy" onerror="this.remove()">' : '';
          var file = o.file_url ? '<a class="bb-filedl" href="' + esc(o.file_url) + '" target="_blank" rel="noopener">'
            + '📎 ' + esc(o.file_name || '첨부 자료 보기') + '</a>' : '';
          var link = o.link_url ? '<a class="bb-extlink" href="' + esc(o.link_url) + '" target="_blank" rel="noopener">관련 링크 바로가기 ↗</a>' : '';
          var body = o.body ? '<div class="bb-body">' + nl2br(o.body) + '</div>' : '';

          var dateLabel = cfg.dateLabel || '';
          var infoLine = [];
          if (o.organizer) infoLine.push('주최 ' + esc(o.organizer));
          if (o.location) infoLine.push('장소 ' + esc(o.location));
          if (o.event_date && dateLabel) infoLine.push(esc(dateLabel) + ' ' + fmtDate(o.event_date));
          var infoBox = infoLine.length ? '<div class="bb-info">' + infoLine.join('<i>·</i>') + '</div>' : '';

          box.innerHTML =
            '<div class="bb-head">'
            + (o.category ? '<span class="bb-tag">' + esc(o.category) + '</span>' : '')
            + '<h1 class="bb-title">' + esc(o.title || '') + '</h1>'
            + infoBox
            + '<div class="bb-meta"><span>' + esc(auName) + '</span><span>' + fmtDate(o.created_at) + '</span><span>조회 ' + (o.view_count || 0) + '</span></div>'
            + '</div>'
            + file + thumb + body + link
            + '<div class="bb-ownbar" id="bbOwnbar"></div>'
            + '<div class="bb-foot"><a href="' + cfg.listPage + '">← 목록으로</a></div>'
            + '<div class="bb-comments" id="bbComments"><h2>댓글</h2><div class="bb-clist" id="bbClist"></div><div class="bb-cform" id="bbCform"></div></div>';

          /* 조회수 — 글마다 이 브라우저에서 한 번만 셉니다 */
          try {
            var seenKey = 'of-bv-' + cfg.board + '-' + id;
            if (!sessionStorage.getItem(seenKey)) {
              sessionStorage.setItem(seenKey, '1');
              fetch(OF.SB_URL + '/rest/v1/rpc/community_post_view', {
                method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, H),
                body: JSON.stringify({ p_id: Number(id) })
              });
            }
          } catch (e) {}

          mountOwnBar(o);
          mountComments(id);
        });
      })['catch'](function (e) {
        box.innerHTML = noteHtml('글을 불러오지 못했습니다 — ' + esc(String(e.message || e).slice(0, 160)));
      });

    function mountOwnBar(o) {
      var bar = document.getElementById('bbOwnbar');
      if (!bar || !window.CM) return;
      CM.me().then(function (me) {
        if (!me) return;
        var mine = me.id === o.author_id;
        var admin = me.is_admin === true;
        if (!mine && !admin) return;
        bar.innerHTML = (mine ? '<a href="' + cfg.writePage + '?id=' + encodeURIComponent(o.id) + '">수정</a>' : '')
          + '<a href="#" id="bbDelBtn">삭제</a>';
        var delBtn = document.getElementById('bbDelBtn');
        if (delBtn) delBtn.addEventListener('click', function (e) {
          e.preventDefault();
          if (!confirm('이 글을 삭제하시겠습니까?')) return;
          OF.sb().then(function (sb) {
            sb.from('community_posts').delete().eq('id', o.id).then(function (r) {
              if (r.error) { alert('삭제 중 오류가 발생했습니다 — ' + r.error.message); return; }
              location.href = cfg.listPage;
            });
          });
        });
      });
    }

    function mountComments(postId) {
      var listBox = document.getElementById('bbClist');
      var formBox = document.getElementById('bbCform');
      if (!listBox) return;

      function renderList() {
        api('community_comments?select=*&post_id=eq.' + encodeURIComponent(postId) + '&hidden=eq.false&order=created_at.asc')
          .then(function (rows) {
            return fetchAuthors(rows.map(function (r) { return r.author_id; })).then(function (authors) {
              if (!rows.length) { listBox.innerHTML = '<p class="bb-cempty">첫 댓글을 남겨 보세요.</p>'; return; }
              listBox.innerHTML = rows.map(function (c) {
                var au = authors[c.author_id];
                return '<div class="bb-citem"><span class="bb-chead"><b>' + esc(au ? au.display_name : '탈퇴회원')
                  + '</b><span>' + fmtDate(c.created_at) + '</span></span>'
                  + '<p>' + nl2br(c.body) + '</p></div>';
              }).join('');
            });
          })['catch'](function () { listBox.innerHTML = '<p class="bb-cempty">댓글을 불러오지 못했습니다.</p>'; });
      }

      function mountForm() {
        if (!window.CM) { formBox.innerHTML = ''; return; }
        CM.session().then(function (ses) {
          if (!ses) {
            formBox.innerHTML = '<p class="bb-cgate"><a href="/account/login.html?next=' + encodeURIComponent(location.pathname + location.search) + '">로그인</a> 후 댓글을 남기실 수 있습니다.</p>';
            return;
          }
          CM.me().then(function (me) {
            if (!me || me.status !== 'approved') {
              formBox.innerHTML = '<p class="bb-cgate">회원 승인 후 댓글을 남기실 수 있습니다.</p>';
              return;
            }
            formBox.innerHTML = '<textarea class="ac-inp" id="bbCbody" rows="3" placeholder="댓글을 입력하세요"></textarea>'
              + '<div class="bb-cerr" id="bbCerr"></div>'
              + '<button class="btn sm" id="bbCsend" type="button">댓글 등록</button>';
            document.getElementById('bbCsend').addEventListener('click', function () {
              var ta = document.getElementById('bbCbody'), err = document.getElementById('bbCerr');
              var body = (ta.value || '').trim();
              err.textContent = '';
              if (!body) { err.textContent = '내용을 입력해 주세요.'; return; }
              OF.sb().then(function (sb) {
                sb.from('community_comments').insert({ post_id: Number(postId), body: body }).then(function (r) {
                  if (r.error) { err.textContent = '등록 중 오류가 발생했습니다 — ' + r.error.message; return; }
                  ta.value = '';
                  renderList();
                });
              });
            });
          });
        });
      }

      renderList();
      mountForm();
    }
  }

  return { list: list, view: view, esc: esc, fmtDate: fmtDate };
})();
