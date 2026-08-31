/* ══════════════════════════════════════════════════════════════════
   OPUSFINE 미술대학 상세 · assets/school-view.js · 고침판
   ------------------------------------------------------------------
   ★★ 2026-08-31 고친 것 둘

     ① <b>오른쪽이 통째로 비었습니다</b> (파트너 지적)
        .sv-txt 의 max-width 는 그대로 두고, <b>두 칸</b>으로 나눕니다.
        왼쪽 소개문 · 오른쪽 자료 칸.

     ② <b>소개문에 위키백과 문법이 새어 나옵니다</b>
        화면에 「== About ==」이 그대로 찍혔습니다.
        세어 보니 185곳에 == 제목 == 이 있습니다. 그 밖의 찌꺼기
        (대괄호·굵게·틀·주석·HTML)는 <b>0곳</b>이라 이것만 다룹니다.

        ▶ <b>DB 는 건드리지 않고 화면에서 갈라 냅니다.</b>
          까닭 — 소개문 221곳 가운데 <b>168곳이 문장 중간에 끊겨</b>
          있습니다(글자 수 상한에 걸린 것). 어차피 위키백과에서
          다시 받아야 하고, 그때 찌꺼기가 또 섞여 옵니다.
          지금 DB 를 고치면 두 번 일입니다.

        ▶ 「History」 같은 제목은 <b>소제목으로 살립니다.</b>
          「References」·「External links」처럼 <b>아래에 글이 없는</b>
          제목은 버립니다 — 위키백과에서 제목만 딸려온 것입니다.
          (References 35곳 · External links 32곳)

   ★★ 그 밖에 지키는 것
     · hidden 은 <b>not.is.true</b>
     · 견본을 두지 않습니다. 실패하면 실패했다고 적습니다.
     · 동문은 <b>온이름이 똑같을 때만</b> 잇습니다.
       「율리우스 아살」이 「태국 태음력」으로 걸린 일이 있었습니다.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var hasKo = function (s) { return /[가-힣]/.test(String(s || '')); };

  function head() {
    return { apikey: OF.SB_KEY, Authorization: 'Bearer ' + OF.SB_KEY };
  }

  function norm(s) {
    return String(s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^0-9a-z가-힣]/g, '');
  }

  async function get(url) {
    var res = await fetch(url, { headers: head() });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 160));
    return await res.json();
  }

  /* ── 소개문 다듬기 ────────────────────────────────────────────
     == 제목 == 을 만나면 토막을 나눕니다.
     토막에 글이 없으면 제목째 버립니다.
     ★ 정규식 둘을 || 로 잇지 않습니다. 앞엣것만 남습니다. */
  function shapeText(raw) {
    var lines = String(raw).split(/\n/);
    var blocks = [];            /* { title, paras[] } */
    var cur = { title: null, paras: [] };

    lines.forEach(function (ln) {
      var t = ln.trim();
      if (!t) return;
      var m = t.match(/^=+\s*(.+?)\s*=+$/);
      if (m) {
        blocks.push(cur);
        cur = { title: m[1].trim(), paras: [] };
      } else {
        cur.paras.push(t);
      }
    });
    blocks.push(cur);

    /* ★ 글이 없는 토막은 버립니다 — References · External links 등 */
    blocks = blocks.filter(function (b) { return b.paras.length; });

    var h = '';
    blocks.forEach(function (b) {
      if (b.title) h += '<h3>' + esc(b.title) + '</h3>';
      h += b.paras.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    });
    return h;
  }

  /* 글이 문장 중간에 끊겼는지 — 끝이 마침표·물음표 등이 아니면 끊긴 것 */
  function looksCut(raw) {
    var t = String(raw || '').trim();
    if (!t) return false;
    return !/[.!?。」』\)\]]$/.test(t);
  }

  /* ── 동문 잇기 ────────────────────────────────────────────── */
  async function linkAlumni(names) {
    var found = {};
    if (!names.length) return found;

    for (var i = 0; i < names.length; i += 20) {
      var part = names.slice(i, i + 20);
      var ors = part.map(function (n) {
        var v = n.replace(/[*(),.]/g, ' ').trim();
        if (!v) return null;
        return 'name_ko.eq.' + encodeURIComponent(v) + ',name_en.eq.' + encodeURIComponent(v);
      }).filter(Boolean).join(',');
      if (!ors) continue;

      try {
        var rows = await get(OF.SB_URL + '/rest/v1/artists?select=id,name_ko,name_en'
          + '&hidden=not.is.true&or=(' + ors + ')&limit=200');
        rows.forEach(function (a) {
          [a.name_ko, a.name_en].forEach(function (nm) {
            if (!nm) return;
            var k = norm(nm);
            if (k && !found[k]) found[k] = a.id;
          });
        });
      } catch (e) { /* 못 이어도 화면은 그립니다 */ }
    }
    return found;
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
    if (s.founded)  sub.push(esc(s.founded) + ' 설립');
    if (sub.length) h += '<div class="sv-sub">' + sub.join('<i>·</i>') + '</div>';
    h += '</div></div>';

    /* 동문 — 이 화면의 주인공이라 위에 둡니다 */
    h += '<div class="sv-sec"><div class="sv-sk">Alumni · 거쳐 간 작가</div>';
    if (s.alumni) {
      var names = String(s.alumni).split(/\s*,\s*/).filter(Boolean);
      var linked = 0;
      h += '<div class="sv-al">';
      h += names.map(function (n) {
        var id = links[norm(n)];
        if (id) {
          linked++;
          return '<a href="/db/artist-view.html?id=' + encodeURIComponent(id) + '">'
               + esc(n) + '</a>';
        }
        return '<span>' + esc(n) + '</span>';
      }).join('');
      h += '</div>';
      if (linked < names.length) {
        h += '<div class="sv-none" style="margin-top:14px">'
          + '점선으로 둘러진 이름은 아직 작가DB에 없습니다 · '
          + names.length + '명 가운데 ' + linked + '명이 이어졌습니다</div>';
      }
    } else {
      h += '<div class="sv-none">동문 자료가 아직 없습니다.</div>';
    }
    h += '</div>';

    /* ══ 두 칸 — 왼쪽 소개문 · 오른쪽 자료 ══ */
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
    if (s.category)    facts.push(['갈래', esc(s.category)]);
    if (s.location)    facts.push(['소재지', esc(s.location)]);
    if (s.founded)     facts.push(['설립', esc(s.founded)]);
    if (s.alumni)      facts.push(['담긴 동문',
                         String(s.alumni).split(/\s*,\s*/).filter(Boolean).length + '명']);
    if (s.wikidata_id) facts.push(['위키데이터', esc(s.wikidata_id)]);
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

      var names = s.alumni ? String(s.alumni).split(/\s*,\s*/).filter(Boolean) : [];
      var links = await linkAlumni(names);

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
