/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 미술시장 공용 엔진 · assets/market-board.js · 2026-10-01
   ------------------------------------------------------------------
   경매 결과·아트페어 결과·시장 리포트 3개 화면이 씁니다.
   assets/of-board.js(회원 게시판)와 뼈대는 비슷하지만 다릅니다 —
   여기 market_posts 는 "회원이 올리는 글"이 아니라 "운영자가 발행하는
   공식 자료"라서, 글쓴이 표시·댓글·수정 버튼이 없고 읽기 전용입니다.
   쓰기는 /admin/market-write.html 에서 운영자 로그인으로만 합니다.

   쓰는 법
     목록   MarketBoard.list({ category:'auction-result',
                                viewPage:'/market/auction-result-view.html' })
     상세   MarketBoard.view({ category:'auction-result',
                                label:'경매 결과',
                                listPage:'/market/auction-result.html' })
   ══════════════════════════════════════════════════════════════════ */
window.MarketBoard = (function () {
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

  function noteHtml(msg) { return '<div class="bb-empty">' + msg + '</div>'; }
  function skeleton(n) {
    var h = '';
    for (var i = 0; i < n; i++) h += '<div class="bb-skel"></div>';
    return h;
  }

  /* ============================ 목록 ============================ */
  function list(cfg) {
    var listEl = document.querySelector('.bb-list');
    var cntEl = document.querySelector('.bb-cnt');
    var moreBox = document.querySelector('.bb-more');
    var moreBtn = moreBox ? moreBox.querySelector('button') : null;
    var qEl = document.querySelector('.bb-q');
    if (!listEl) return;

    var page = 0, total = null, busy = false, q = '';
    var searchCols = cfg.searchCols || ['title', 'body'];

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
      p.push('select=id,title,thumb_url,file_name,link_url,view_count,is_pinned,created_at,body,event_date,location,organizer');
      p.push('category=eq.' + encodeURIComponent(cfg.category));
      p.push('hidden=eq.false');
      if (q) {
        var w = '*' + q.replace(/[*(),]/g, '') + '*';
        p.push('or=(' + searchCols.map(function (c) { return c + '.ilike.' + w; }).join(',') + ')');
      }
      p.push('order=is_pinned.desc,created_at.desc');
      return OF.SB_URL + '/rest/v1/market_posts?' + p.join('&');
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

    function row(p) {
      var vp = cfg.viewPage + '?id=' + encodeURIComponent(p.id);
      var th = p.thumb_url ? '<span class="bb-row-thumb"><img src="' + esc(p.thumb_url) + '" alt="" loading="lazy" onerror="this.closest(\'.bb-row-thumb\').remove()"></span>' : '';
      var dateLabel = cfg.dateLabel || '';
      var evt = (p.event_date && dateLabel) ? '<span class="bb-tag evt">' + esc(dateLabel) + ' ' + fmtDate(p.event_date) + '</span>' : '';
      var orgLoc = [p.organizer, p.location].filter(Boolean).map(esc).join(' · ');
      return '<a class="bb-row' + (p.is_pinned ? ' pin' : '') + (th ? ' has-thumb' : '') + '" href="' + vp + '">'
        + th
        + '<span class="bb-row-main">'
        +   '<span class="bb-row-head">'
        +     (p.is_pinned ? '<span class="bb-tag pin">고정</span>' : '')
        +     evt
        +     '<span class="bb-row-date">' + fmtDate(p.created_at) + '</span>'
        +   '</span>'
        +   '<span class="bb-row-title">' + esc(p.title || '') + (p.link_url ? ' <i class="bb-ext">↗</i>' : '') + '</span>'
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
        if (page === 0) listEl.innerHTML = '';
        if (!rows.length && page === 0) {
          listEl.innerHTML = noteHtml('아직 발행된 자료가 없습니다.');
          if (moreBox) moreBox.hidden = true;
          if (cntEl) cntEl.textContent = '0건';
          busy = false;
          return;
        }
        listEl.insertAdjacentHTML('beforeend', rows.map(row).join(''));
        page++;
        if (total != null && cntEl) cntEl.innerHTML = '<b>' + total.toLocaleString() + '</b>건';
        if (moreBox) moreBox.hidden = rows.length === 0 || (total != null && page * PER >= total);
        busy = false;
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

    api('market_posts?select=*&category=eq.' + encodeURIComponent(cfg.category) + '&id=eq.' + encodeURIComponent(id) + '&limit=1')
      .then(function (rows) {
        var o = rows && rows[0];
        if (!o) { box.innerHTML = noteHtml('글을 찾을 수 없거나 삭제되었습니다.'); return; }
        document.title = (o.title || cfg.label || '미술시장') + ' · OPUSFINE';

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
          + '<h1 class="bb-title">' + esc(o.title || '') + '</h1>'
          + infoBox
          + '<div class="bb-meta"><span>OPUSFINE</span><span>' + fmtDate(o.created_at) + '</span><span>조회 ' + (o.view_count || 0) + '</span></div>'
          + '</div>'
          + file + thumb + body + link
          + '<div class="bb-foot"><a href="' + cfg.listPage + '">← 목록으로</a></div>';

        /* 조회수 — 이 브라우저에서 글마다 한 번만 셉니다 */
        try {
          var seenKey = 'of-mv-' + cfg.category + '-' + id;
          if (!sessionStorage.getItem(seenKey)) {
            sessionStorage.setItem(seenKey, '1');
            fetch(OF.SB_URL + '/rest/v1/rpc/market_post_view', {
              method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, H),
              body: JSON.stringify({ p_id: Number(id) })
            });
          }
        } catch (e) {}
      })['catch'](function (e) {
        box.innerHTML = noteHtml('글을 불러오지 못했습니다 — ' + esc(String(e.message || e).slice(0, 160)));
      });
  }

  return { list: list, view: view, esc: esc, fmtDate: fmtDate };
})();
