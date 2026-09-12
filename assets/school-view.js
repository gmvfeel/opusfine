/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 미술대학 상세 · assets/school-view.js · 2026-09-07 고침판
   ------------------------------------------------------------------
   ★★ 이번에 고친 것 둘

     ① <b>정규화가 한글을 지우고 있었습니다.</b>

        norm() 이 `normalize('NFD')` 로 시작하는데, NFD 는
        <b>한글을 자모로 분해합니다.</b> 「백」 → ㅂ+ㅐ+ㄱ.
        그 자모는 `가-힣` 범위 밖이라 뒤이은
        `replace(/[^0-9a-z가-힣]/g,'')` 에서 <b>전부 지워집니다.</b>

        작가 1,446명으로 재어 보니 정규화 키가 <b>595개</b>뿐이었습니다.
        「백남준」·「이방자」가 빈 문자열이 되어 있었습니다.
        악센트(é ü ø)를 지우려고 NFD 를 붙였는데 한글을 죽인 것입니다.

        ▶ 고침 — 결합문자를 지운 뒤 <b>normalize('NFC') 로 되돌립니다.</b>
          한 줄이 빠져 있었습니다. 고친 뒤 키가 <b>1,941개</b>가 됐습니다.

        ※ 「데이터 설계 규칙」 2-3 의 SQL 정규식에는 이 함정이 없습니다.
          NFD 는 JS 로 옮길 때 제가 덧붙인 것이고, 그것이 원인이었습니다.
          <b>같은 함정이 스타덤에도 그대로 생깁니다.</b>

     ② <b>화면에서 이름을 맞대지 않습니다.</b>

        전에는 화면을 열 때마다 동문 이름과 작가DB 를 맞댔습니다.
        규칙 3-3(같은 규칙을 두 파일에 쓰지 말 것)에 어긋나고,
        규칙 1-4(못 이은 관계는 이름만 링크로 보존)도 못 지켰습니다 —
        못 이은 이름이 <b>어디에도 남지 않았습니다.</b>

        ▶ 고침 — <b>entity_links 표를 읽습니다.</b>
          이어진 것은 `to_id`, 못 이은 것은 `to_label` 로 들어 있습니다.
          판정은 이관 SQL 한 곳에서만 합니다.

        ★ 표가 아직 없거나 그 학교 줄이 없으면 <b>schools.alumni 원본을
          그대로 보여 줍니다.</b> 이관 전에도 화면이 비지 않습니다.

   ★★ 그 밖에 지키는 것
     · hidden 은 <b>not.is.true</b>
     · 견본을 두지 않습니다. 실패하면 실패했다고 적습니다 (규칙 6-4)
     · 오른쪽 자료 칸 · == 제목 == 을 소제목으로 · 끊긴 소개문 표시
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';


  /* ── 다국어 도우미 ───────────────────────────────────────────
     ★ 화면 글을 사전에 태웁니다. i18n.js 가 아직 안 실렸으면
       원문을 그대로 돌려주므로 한국어 화면은 그대로 돕니다.
     ★ N() 은 <b>숫자가 낀 글</b>용입니다. 「250곳」처럼 숫자와 낱말이
       붙은 것은 사전 열쇠로 쓸 수 없습니다 — 숫자가 바뀌면 열쇠가
       달라지니까요. 그래서 「{n}곳」을 열쇠로 두고 값만 끼웁니다.
       (오퍼스클램이 2026-08-15 에 같은 일을 겪고 정한 방식입니다) */
  function T(s) { return (window.OFI18N && window.OFI18N.t) ? window.OFI18N.t(s) : s; }
  function N(tpl) {
    var args = [].slice.call(arguments);
    if (window.OFI18N && window.OFI18N.n) return window.OFI18N.n.apply(null, args);
    var vals = args.slice(1);
    return String(tpl).replace(/\{(n|\d+)\}/g, function (m, k) {
      var v = (k === 'n') ? vals[0] : vals[Number(k)];
      if (v === undefined || v === null) return m;
      if (typeof v !== 'number') return String(v);
      if (v >= 1000 && v < 3000 && v === Math.floor(v)) return String(v);
      return v.toLocaleString();
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var hasKo = function (s) { return /[가-힣]/.test(String(s || '')); };

  function head() {
    return { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  }

  async function get(url) {
    var res = await fetch(url, { headers: head() });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 160));
    return await res.json();
  }

  /* ── 소개문 다듬기 ────────────────────────────────────────────
     == 제목 == 으로 토막을 나눕니다. 글이 없는 토막은 제목째 버립니다
     (References · External links 처럼 위키백과에서 제목만 딸려온 것). */
  function shapeText(raw) {
    var lines = String(raw).split(/\n/);
    var blocks = [];
    var cur = { title: null, paras: [] };

    lines.forEach(function (ln) {
      var t = ln.trim();
      if (!t) return;
      var m = t.match(/^=+\s*(.+?)\s*=+$/);
      if (m) { blocks.push(cur); cur = { title: m[1].trim(), paras: [] }; }
      else cur.paras.push(t);
    });
    blocks.push(cur);
    blocks = blocks.filter(function (b) { return b.paras.length; });

    var h = '';
    blocks.forEach(function (b) {
      if (b.title) h += '<h3>' + esc(b.title) + '</h3>';
      h += b.paras.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    });
    return h;
  }

  function looksCut(raw) {
    var t = String(raw || '').trim();
    if (!t) return false;
    return !/[.!?。」』\)\]]$/.test(t);
  }

  /* ── 동문 · entity_links 에서 읽습니다 ────────────────────────
     이어진 것 : to_id 있음 → 작가 화면으로 링크
     이름만    : to_id 비어 있음 → 점선으로 그대로 보임 */
  async function loadAlumni(schoolId) {
    try {
      var rows = await get(OF.SB_URL + '/rest/v1/entity_links'
        + '?select=to_id,to_label,from_year,to_year,date_note,sort_no'
        + '&from_type=eq.school&from_id=eq.' + encodeURIComponent(schoolId)
        + '&rel=eq.alumnus_of&order=sort_no.asc&limit=300');
      return Array.isArray(rows) ? rows : null;
    } catch (e) {
      /* 표가 아직 없으면 여기로 옵니다. 원본으로 되돌아갑니다. */
      return null;
    }
  }

  /* ── 그리기 ───────────────────────────────────────────────── */
  function render(s, links) {
    var name  = s.name_ko || s.name_en || '(이름 없음)';
    var roman = !hasKo(name);
    var logo  = s.logo_url || s.image_url;
    var desc  = s.description || s.bio;

    var h = '';

    /* 머리 */
    h += '<div class="sv-hd">';
    h += logo
      ? '<div class="sv-logo"><img src="' + esc(logo) + '" alt=""'
        + ' onerror="this.parentNode.classList.add(&quot;none&quot;);this.remove()"></div>'
      : '<div class="sv-logo none"></div>';
    h += '<div class="sv-hb">';
    if (s.category) h += '<div class="sv-cat">' + esc(s.category) + '</div>';
    h += '<h1 class="sv-nm' + (roman ? ' roman' : '') + '">' + esc(name) + '</h1>';
    if (!roman && s.name_en && s.name_en !== name) {
      h += '<div class="sv-en">' + esc(s.name_en) + '</div>';
    }
    var sub = [];
    if (s.location) sub.push(esc(s.location));
    if (s.founded)  sub.push(N('{n} 설립', esc(s.founded)));
    if (sub.length) h += '<div class="sv-sub">' + sub.join('<i>·</i>') + '</div>';
    h += '</div></div>';

    /* ── 동문 ── */
    h += '<div class="sv-sec"><div class="sv-sk">Alumni · 거쳐 간 작가</div>';

    var items = null, fromTable = false;
    if (links && links.length) {
      items = links.map(function (r) {
        var when = '';
        if (r.from_year || r.to_year) {
          when = ' ' + (r.from_year || '') + '–' + (r.to_year || '');
        } else if (r.date_note) {
          when = ' ' + r.date_note;
        }
        return { id: r.to_id, label: r.to_label, when: when };
      });
      fromTable = true;
    } else if (s.alumni) {
      /* 표가 아직 없을 때 — 원본을 그대로 보여 줍니다 */
      items = String(s.alumni).split(/\s*,\s*/).filter(Boolean).map(function (n) {
        return { id: null, label: n, when: '' };
      });
    }

    if (items && items.length) {
      var linked = 0;
      h += '<div class="sv-al">';
      h += items.map(function (it) {
        if (it.id) {
          linked++;
          return '<a href="/db/artist-view.html?id=' + encodeURIComponent(it.id) + '">'
               + esc(it.label) + esc(it.when) + '</a>';
        }
        return '<span>' + esc(it.label) + esc(it.when) + '</span>';
      }).join('');
      h += '</div>';

      h += '<div class="sv-none" style="margin-top:14px">';
      if (linked < items.length) {
        h += '점선으로 둘러진 이름은 아직 작가DB에 없습니다 · '
          + items.length + '명 가운데 ' + linked + '명이 이어졌습니다';
      } else {
        h += items.length + '명 모두 작가DB와 이어졌습니다';
      }
      if (!fromTable) {
        h += ' · 아직 관계 표로 옮기지 않아 원본을 그대로 보여 드립니다';
      }
      h += '</div>';
    } else {
      h += '<div class="sv-none">동문 자료가 아직 없습니다.</div>';
    }
    h += '</div>';

    /* ── 두 칸 — 왼쪽 소개문 · 오른쪽 자료 ── */
    h += '<div class="sv-cols">';

    h += '<div class="sv-main"><div class="sv-sk">About</div>';
    if (desc) {
      h += '<div class="sv-txt">' + shapeText(desc) + '</div>';
      if (looksCut(desc)) {
        h += '<div class="sv-cut">이 소개문은 문장 중간에서 끊겨 있습니다 — '
          + '자료를 받을 때 글자 수 상한에 걸린 것입니다. 위키백과에서 다시 받을 예정입니다.';
        if (s.link_wiki) {
          h += ' <a href="' + esc(s.link_wiki) + '" target="_blank" rel="noopener">'
            + '위키백과에서 온전히 읽기 →</a>';
        }
        h += '</div>';
      }
    } else {
      h += '<div class="sv-none">소개문이 아직 없습니다.</div>';
    }
    h += '</div>';

    h += '<div class="sv-side"><div class="sv-sidein"><div class="sv-facts">';
    h += '<div class="sv-fk">Information</div>';
    var facts = [];
    if (s.category)    facts.push([T('갈래'), esc(s.category)]);
    if (s.location)    facts.push([T('소재지'), esc(s.location)]);
    if (s.founded)     facts.push([T('설립'), esc(s.founded)]);
    if (items && items.length) facts.push([T('담긴 동문'), N('{n}명', items.length)]);
    if (s.wikidata_id) facts.push([T('위키데이터'), esc(s.wikidata_id)]);
    if (!facts.length) facts.push(['—', '자료가 아직 없습니다']);
    h += facts.map(function (f) {
      return '<div class="sv-frow"><span class="k">' + f[0] + '</span>'
           + '<span class="v">' + f[1] + '</span></div>';
    }).join('');

    var ln = [];
    if (s.link_home) ln.push('<a href="' + esc(s.link_home) + '" target="_blank" rel="noopener">공식 홈페이지 →</a>');
    if (s.link_wiki) ln.push('<a href="' + esc(s.link_wiki) + '" target="_blank" rel="noopener">위키백과 →</a>');
    if (s.wikidata_id) ln.push('<a href="https://www.wikidata.org/wiki/' + esc(s.wikidata_id)
      + '" target="_blank" rel="noopener">위키데이터 →</a>');
    if (ln.length) h += '<div class="sv-links">' + ln.join('') + '</div>';

    h += '</div></div></div>';
    h += '</div>';

    /* 자료 출처 */
    h += '<div class="sv-sec" style="border:0">'
      + '<p class="demo-note">이 자료는 <b>위키데이터</b>와 <b>위키백과</b>에서 받았습니다 · '
      + '로고는 위키미디어 커먼즈의 원본을 링크합니다';
    if (roman) h += ' · 한글 이름이 아직 없어 영문으로 보입니다';
    h += '</p></div>';

    return h;
  }

  async function boot() {
    var box = document.getElementById('svMain');
    var bc  = document.getElementById('svBc');
    if (!box) return;

    var id = new URLSearchParams(location.search).get('id');
    if (!id) {
      box.innerHTML = '<div class="sv-sec" style="border:0">'
        + '<div class="demo-note">주소에 학교 번호가 없습니다. '
        + '<a href="/db/school.html">목록</a>에서 골라 주십시오.</div></div>';
      if (bc) bc.textContent = '—';
      return;
    }

    try {
      var rows = await get(OF.SB_URL + '/rest/v1/schools?select=*'
        + '&id=eq.' + encodeURIComponent(id) + '&hidden=not.is.true&limit=1');
      if (!rows.length) {
        box.innerHTML = '<div class="sv-sec" style="border:0">'
          + '<div class="demo-note">그 학교를 찾지 못했습니다. '
          + '<a href="/db/school.html">목록으로</a></div></div>';
        if (bc) bc.textContent = '—';
        return;
      }
      var s = rows[0];
      var name = s.name_ko || s.name_en || '(이름 없음)';
      document.title = name + ' — OPUSFINE';
      if (bc) bc.textContent = name;

      var links = await loadAlumni(s.id);
      box.innerHTML = render(s, links);

    } catch (e) {
      box.innerHTML = '<div class="sv-sec" style="border:0"><div class="demo-note">'
        + '자료를 불러오지 못했습니다 — ' + esc(String(e.message).slice(0, 200))
        + '</div></div>';
      if (bc) bc.textContent = '—';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
