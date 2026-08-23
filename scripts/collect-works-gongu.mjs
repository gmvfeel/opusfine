#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 공유마당 · scripts/collect-works-gongu.mjs
   ------------------------------------------------------------------
   쓰는 법
     node scripts/collect-works-gongu.mjs --peek
     node scripts/collect-works-gongu.mjs --lic 97,98 --dry
     node scripts/collect-works-gongu.mjs --limit 500 --dry
     node scripts/collect-works-gongu.mjs

   ★★ 2026-08-23 · <b>정의서를 받아 짐작을 걷어 냈습니다</b> (파트너 제공).
     요청 주소·코드표·응답 항목이 다 적혀 있습니다. 오늘 e뮤지엄에서
     주소를 못 찾아 두 시간을 쓴 것과 정반대입니다.

     요청 URL  http://gongu.copyright.or.kr/gongu/wrt/wrtApi/search.json

   ★ 공유마당이 왜 좋은가
     · 회화만 <b>30,603건</b> · 서예·조형·공예·판화도 따로
     · <b>저작권 처리가 끝난 것만</b> 모아 둔 곳입니다. 우리가 손으로
       하던 「사후 70년」 판단을 그쪽이 이미 해 두었습니다.
     · 상세에 <b>재료·크기·소장처·제작연도</b>가 옵니다 —
       우리 시그니처 캡션(작가/《작품》,연도/재료/소장처)에 딱 맞습니다.

   ★★ 라이선스를 <b>골라 받습니다</b>
     오퍼스파인에는 광고가 붙습니다(상업적 이용). 그래서
     <b>상업적 이용이 막힌 것은 아예 받지 않습니다.</b>
       받음  97 만료 · 98 기증(자유이용) · 01 KOGL 제1유형 · 21 CC BY · 23 CC BY-SA
       안 받음 02·04 KOGL 상업금지 · 24·26·27 CCL 비영리
       안 받음 22·25 CCL 변경금지 — <b>썸네일로 줄이는 것도 「변경」</b>일
              수 있습니다. 다툼의 소지를 애초에 안 만듭니다.
     ★ 99 기증(이용허락)도 뺍니다 — 건별로 허락을 받아야 합니다.

   ★ --peek 은 담지 않고 <b>몇 건인지·도판이 뜨는지</b>만 봅니다.
   ══════════════════════════════════════════════════════════════════ */

import { makeGetJSON, isStop, stopReason } from './lib/http.mjs';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const KEY    = process.env.GONGU_KEY;

const API = 'https://gongu.copyright.or.kr/gongu/wrt/wrtApi/search.json';
const UA  = 'OpusfineBot/1.0 (https://opusfine.com; cser@wixon.co.kr)';

/* 정의서 코드표 — 짐작이 아니라 <b>받아 적은 것</b>입니다 */
const LICENSE = {
  '97': { nm: '만료',            ok: true,  rights: 'public' },
  '98': { nm: '기증(자유이용)',  ok: true,  rights: 'public' },
  '01': { nm: 'KOGL 출처표시',   ok: true,  rights: 'public' },
  '21': { nm: 'CC BY',           ok: true,  rights: 'public' },
  '23': { nm: 'CC BY-SA',        ok: true,  rights: 'public' },
  '99': { nm: '기증(이용허락)',  ok: false },
  '02': { nm: 'KOGL 상업금지',   ok: false },
  '03': { nm: 'KOGL 변경금지',   ok: false },
  '04': { nm: 'KOGL 상업+변경금지', ok: false },
  '20': { nm: 'CCL(기타)',       ok: false },
  '22': { nm: 'CC BY-ND',        ok: false },
  '24': { nm: 'CC BY-NC',        ok: false },
  '25': { nm: 'CC BY-NC-ND',     ok: false },
  '26': { nm: 'CC BY-NC-SA',     ok: false },
  '27': { nm: 'CCL(기타)',       ok: false }
};
/* ★ 명령줄을 <b>먼저</b> 읽습니다 — 아래 USE 가 --lic 를 봅니다 */
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] || d) : d; };

/* ★★ 2026-08-23 · 라이선스마다 <b>성격이 딴판</b>입니다 (파트너 확인).
     97 만료 13,160건 — 저작권이 끝난 <b>옛 작품</b>. 묵매도·괴석·구고청향도
     98 기증(자유) 3,243건 — 기증받은 작품
     01 KOGL 41,082건 · 21 CC BY 30,161건
        — 공공기관·위원회가 만든 <b>디자인 소재</b>가 대부분입니다.
          PPT 템플릿·유튜브 썸네일·글꼴 견본·다이어리 속지.

   ★ 다섯을 뭉쳐 물었더니 <b>표본 200줄에 미술 작품이 0건</b>이었습니다.
     최신순이라 소재가 목록을 다 차지한 것입니다.

   ▶ <b>97·98 만</b> 받습니다. 16,403건이고 그것이 옛 작품입니다.
     KOGL·CC BY 안에도 박물관 유물 사진이 섞여 있을 수 있지만,
     그건 태그로 골라 <b>나중에 따로</b> 받습니다.
   ★ --lic 로 바꿔 부를 수 있습니다. */
/* ★★ 2026-08-23 · 라이선스마다 200줄씩 세어 보고 <b>97 하나만</b>
     남겼습니다 (파트너 확인).
       97 만료          200/200 (100%) — 미술·국내미술·동양화·고전미술
                        오세창 49 · 김정희 47 · 김홍도 35 · 윤용구 16
       98 기증(자유)     0/200 — 일러스트·달력·캘린더
       01 KOGL          0/200 — 태그조차 없음
       21 CC BY         0/200 — 그래픽디자인·다이어리·스티커
     98·01·21 은 <b>한 건도 못 씁니다.</b> 뺍니다. */
const USE_DEFAULT = ['97'];
const USE = (argv.includes('--lic')
  ? String(arg('lic', '')).split(',').map((x) => x.trim()).filter(Boolean)
  : USE_DEFAULT).filter((k) => LICENSE[k] && LICENSE[k].ok);

const WRT_ART   = '10004';   /* 저작물유형 · 미술 */
const FILE_IMG  = '02';      /* 파일유형 · 이미지 */

const getJSON = makeGetJSON({
  ua: UA, accept: 'application/json',
  tries: 5, maxWaitMs: 120 * 1000, budgetMs: 40 * 60 * 1000
});

const PEEK  = argv.includes('--peek');
const DRY   = argv.includes('--dry');
const LIMIT = Number(arg('limit', 5000));
const PAGE  = 100;

if (!KEY) {
  console.error('★ GONGU_KEY 가 없습니다. 공유마당 API 키를 Secrets 에 넣으십시오.');
  process.exit(1);
}
if (!PEEK && (!SB_URL || !SB_KEY)) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

function url(page, rows, lic) {
  return API + '?apiKey=' + encodeURIComponent(KEY)
    + '&wrtTy=' + WRT_ART + '&wrtFileTy=' + FILE_IMG
    + '&licenseCd=' + (lic || USE.join(','))
    + '&pageUnit=' + rows + '&pageIndex=' + page;
}

/* 응답에서 줄을 꺼냅니다 — 정의서에 resultList 로 적혀 있습니다 */
function rowsOf(j) {
  if (!j) return [];
  if (Array.isArray(j.resultList)) return j.resultList;
  for (const k of Object.keys(j)) if (Array.isArray(j[k]) && j[k].length && j[k][0].wrtSn) return j[k];
  return [];
}
const totalOf = (j) => Number((j && (j.resultCnt ?? j.totalCount)) || 0);

/* ── 우리 작가DB ── */
async function loadArtists() {
  const byName = new Map();
  let from = 0;
  for (;;) {
    const r = await fetch(SB_URL + '/rest/v1/artists?select=id,name_ko,name_en&limit=1000&offset=' + from,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) break;
    const rows = await r.json();
    if (!rows.length) break;                       /* ★ 0줄일 때 끝냅니다 */
    for (const a of rows) for (const nm of [a.name_ko, a.name_en]) {
      if (!nm) continue;
      const k = String(nm).trim();
      if (!k) continue;
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push(a.id);
    }
    from += rows.length;
  }
  return byName;
}

/* 도판 주소 — 크기 고르개(thumbSe)를 바꿔 줍니다 */
function thumbOf(o, size) {
  const u = String(o.thumbUrl || o.detailThmbUrl || '').trim();
  if (!u) return null;
  if (size === 'small' && SMALL_OK) return u.replace(/thumbSe=[^&]*/, 'thumbSe=' + SMALL_SE);
  return u;
}
/* ★★ 2026-08-23 · 크기 고르개(thumbSe)는 <b>안 먹습니다</b> (파트너 확인).
     t_thumb·b_thumb·s_thumb·m_thumb·l_thumb 모두 같은 483KB 였습니다.
     API 로는 못 줄이므로 원본을 링크합니다. 나중에 R2 로 옮길 때
     우리가 줄입니다. */
let SMALL_OK = false;
let SMALL_SE = 'b_thumb';

/* ── 미술 작품 가리기 ──────────────────────────────────────────
   ★★ 2026-08-23 · 태그를 세어 보고 <b>거르개를 뒤집었습니다</b>
     (파트너 확인). 표본 200줄의 태그가 이랬습니다.
       일러스트 127 · 국민저작물 118 · 보물찾기 118 · 디자인 68
       그래픽디자인 63 · 디지털다이어리 37 · 패턴 35 · PPT 9
       템플릿 9 · 유튜브썸네일 7 · 감탄로드탄탄체 18
     <b>미술 작품이 아닙니다.</b> PPT 템플릿·유튜브 썸네일·
     다이어리 속지·글꼴 견본입니다.

   ★ 앞 판은 「한국 것인가」만 물었고 200줄이 <b>모두 통과</b>했습니다.
     한국에서 만든 <b>디자인 소재</b>였기 때문입니다.
     이대로 담으면 오퍼스파인이 <b>PPT 템플릿 창고</b>가 됩니다.

   ▶ 물음을 바꿉니다 — <b>「고전·전통 미술인가」</b>.
     들어오는 낱말이 <b>있어야만</b> 담습니다. 없으면 뺍니다.
     ★ 모를 때 <b>안 담는 쪽</b>입니다. 87,705건 가운데 옥석이
       섞여 있고, 놓친 것은 나중에 더하면 되지만 잘못 담긴
       템플릿은 「조선의 작품」인 양 화면에 남습니다.

   ★ 실물로 확인한 것 — 묵매도(허형)·괴석(안중식)·구고청향도(안중식)는
     「미술,국내미술,동양화,고전미술」로 제대로 달려 있습니다. */

/* 들어오는 낱말 — 하나라도 있어야 담습니다 */
const TAG_IN = /고전미술|국내미술|동양화|한국화|민화|불화|산수화|문인화|풍속화|화조화|영모화|초상화|어진|서예|서화|수묵|채색화|판화|도자|백자|청자|분청|공예품|유물|국보|보물|조선시대|고려시대|삼국시대|근대미술/;

/* 나가는 낱말 — 하나라도 있으면 뺍니다 (들어오는 낱말보다 셉니다) */
const TAG_OUT = /일러스트|디자인|템플릿|PPT|프레젠테이션|패턴|썸네일|다이어리|국민저작물|보물찾기|글꼴|폰트|체\b|아이콘|캘리그라피|배경화면|스티커|카드뉴스|굿즈|모션|3D|픽토그램|이모티콘|해외미술|서양미술/;

function isArtwork(o) {
  const tag = String(o.tagNmList || '');
  const cls = String(o.clListName || o.clNm || '');
  const t = tag + ' ' + cls;

  /* ★ 나가는 낱말이 <b>먼저</b>입니다. 「고전미술」과 「템플릿」이
       같이 달린 것이 있는데, 그런 것은 소재입니다. */
  if (TAG_OUT.test(t)) return false;
  if (!TAG_IN.test(t)) return false;

  /* ★ 제목·작가에 한글이나 한자가 있어야 합니다 —
       Bonnard·Munch 같은 바깥 것을 여기서 뺍니다. */
  const s2 = String(o.orginSj || '') + ' ' + String(o.authorListNm || '');
  if (!/[가-힣\u4E00-\u9FFF]/.test(s2)) return false;

  return true;
}

function quality(w) {
  let n = 0;
  if (w.image_url)   n += 4;
  if (w.year_text)   n += 2;
  if (w.medium)      n += 2;
  if (w.artist_name) n += 2;
  if (w.artist_id)   n += 2;
  if (w.holder)      n += 1;
  if (w.link_source) n += 1;
  if (w.genre)       n += 1;
  return n;
}

/* ── 한 점 만들기 ──
   ★ 목록만으로도 담을 수 있게 짭니다. 상세는 재료·소장처가 있어
     더 좋지만 <b>건마다 한 번 더 물어야</b> 합니다. 하루 한도가
     있으므로 목록으로 먼저 채우고, 상세는 나중에 채웁니다. */
function build(o, byName) {
  const sn = String(o.wrtSn || '').trim();
  const title = String(o.orginSj || '').trim();
  if (!sn || !title) return null;

  /* ★ 라이선스를 <b>다시 확인</b>합니다. 요청에서 걸렀어도
       응답이 다르게 올 수 있습니다 — 믿고 넘어가지 않습니다. */
  const code = String(o.licenseCd || '').padStart(2, '0');
  const L = LICENSE[code];
  if (!L || !L.ok) return null;

  /* ★ 미술 작품만 담습니다 — 위 isArtwork 주석 참조 */
  if (!isArtwork(o)) return null;

  /* ★★ 2026-08-23 · 작가 이름이 <b>「허형(許瀅)」</b> 꼴로 옵니다
       (파트너 확인). 그대로 담으면 우리 작가DB 의 「허형」과 영영
       안 맞습니다. 괄호를 떼고, 안에 든 한자는 <b>버리지 않고</b>
       따로 챙깁니다 — 나중에 작가 잇기에 쓸 수 있습니다. */
  const raw = String(o.authorListNm || o.athrNm || '').split(',')[0].trim();
  const nm = /^(.+?)\s*[(（]\s*([^)）]+)\s*[)）]\s*$/.exec(raw);
  const who  = nm ? nm[1].trim() : raw;
  const whoHan = nm ? nm[2].trim() : null;
  /* 제목도 「묵매도(墨梅圖)」 꼴이 섞입니다 — 같은 방식으로 가릅니다 */
  const tm = /^(.+?)\s*[(（]\s*([\u4E00-\u9FFF\s]+)\s*[)）]\s*$/.exec(title);
  const titleKo  = tm ? tm[1].trim() : title;
  const titleHan = tm ? tm[2].replace(/\s+/g, '') : null;

  const w = {
    gongu_sn:   sn,
    title:      titleKo,
    title_han:  titleHan,
    title_en:   null,
    year_text:  String(o.orginCrtDt || '').trim() || null,
    medium:     String(o.orginMatrlTech || '').trim() || null,
    dimensions: String(o.orginSize || '').trim() || null,
    genre:      String(o.clListName || o.clNm || '').replace(/\s+/g, ' ').trim() || null,
    artist_name: (!who || /미상/.test(who)) ? null : who,
    artist_id:  null,
    link_status: 'none',
    /* ★★ 도판이 495KB~795KB 입니다 (파트너 확인). 목록에 스무 장이면
         10MB 가 넘습니다. 주소에 thumbSe 라는 <b>크기 고르개</b>가 있어
         작은 것으로 바꿔 담습니다 — t_thumb(큰 것) → b_thumb(작은 것).
       ★ 다만 <b>있는지 확인한 뒤</b> 씁니다. --peek 에서 재 봅니다.
         없으면 그대로 큰 것을 씁니다. */
    image_url:  thumbOf(o, 'big'),
    image_small: thumbOf(o, 'small'),
    image_credit: '공유마당 · ' + (o.srcTrgetInttNm || '한국저작권위원회')
                + ' (' + (L.nm) + ')',
    rights:     L.rights,
    holder:     String(o.orginPosesn || o.srcTrgetInttNm || '').trim() || null,
    link_source: String(o.gongLinkUrl || o.linkUrl || '').trim()
              || ('https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=' + sn),
    hidden:     false
  };

  /* 작가 잇기 — 이름이 꼭 같고 하나뿐일 때만 */
  if (w.artist_name) {
    const hit = byName.get(w.artist_name);
    if (hit && hit.length === 1) { w.artist_id = hit[0]; w.link_status = 'auto'; }
    else if (hit && hit.length > 1) { w.link_status = 'ambig'; }
  }
  w.quality = quality(w);
  if (w.quality < 4) return null;
  return w;
}

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/artworks?on_conflict=gongu_sn', {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 300);
    if (t.includes('42P10') || t.includes('gongu_sn'))
      return { ok: 0, msg: '★ artworks.gongu_sn 칸이나 고유 인덱스가 없습니다. '
                         + 'sql/gongu-14-B-apply.sql 을 먼저 돌리십시오. (' + t + ')' };
    return { ok: 0, msg: r.status + ' ' + t };
  }
  return { ok: rows.length, msg: '' };
}

/* ══ 엿보기 ══════════════════════════════════════════════════════ */
async function peek() {
  console.log('▶ 공유마당 엿보기 — 담지 않습니다\n');

  /* ① 닿는가 · 열쇠가 먹는가 */
  console.log('── ① 닿는가 · 열쇠가 먹는가');
  let j = null;
  try { j = await getJSON(url(1, 3, '97')); }
  catch (e) {
    console.log('   ✕ ' + String(e.message).slice(0, 160));
    console.log('     (api.kcisa.kr 과 같은 증상이면 GitHub Actions 에서는 못 받습니다)');
    return;
  }
  const rows0 = rowsOf(j);
  console.log(`   ✔ 답이 옵니다 · 전체 ${totalOf(j).toLocaleString()}건 · 이번에 ${rows0.length}줄`);
  if (!rows0.length) {
    console.log('   ※ 줄이 없습니다. 답 앞부분 —');
    console.log('   ' + JSON.stringify(j).slice(0, 600));
    return;
  }

  /* ② 라이선스마다 몇 건인가 */
  console.log('\n── ② 라이선스마다 몇 건인가 (미술 · 이미지)');
  for (const [code, L] of Object.entries(LICENSE)) {
    let n = null;
    try { n = totalOf(await getJSON(url(1, 1, code))); } catch (e) { }
    console.log(`   ${(L.ok ? '받음  ' : '안 받음')} ${code} ${L.nm.padEnd(18)}`
              + (n == null ? '(못 셈)' : n.toLocaleString() + '건'));
  }
  let useN = null;
  try { useN = totalOf(await getJSON(url(1, 1))); } catch (e) { }
  console.log(`   ── 받을 것 모두: ${useN == null ? '?' : useN.toLocaleString()}건`);

  /* ③ 한 줄이 무엇을 주나 */
  console.log('\n── ③ 한 줄이 주는 칸과 값');
  const o = rows0[0];
  for (const k of Object.keys(o)) {
    console.log('   ' + k.padEnd(20)
      + String(o[k] === null || o[k] === '' ? '(빈 값)' : o[k]).slice(0, 78).replace(/\s+/g, ' '));
  }

  console.log('\n── ④ 우리 표에 들어갈 모습');
  const w = build(o, new Map());
  if (!w) console.log('   (충실도가 모자라거나 라이선스가 안 맞아 담지 않습니다)');
  else for (const [k, v] of Object.entries(w))
    console.log('   ' + k.padEnd(14) + String(v === null ? '(빈 값)' : v).slice(0, 88));

  /* ⑤ 도판 — 뜨는가 · <b>더 작은 것이 있는가</b>
     ★★ 목록 도판이 495KB~795KB 입니다. 목록에 스무 장이면 10MB 를
       넘습니다. 주소의 thumbSe 를 바꿔 <b>작은 것이 있는지</b> 재 봅니다.
       짐작으로 바꿔 담지 않습니다 — 없는 크기를 넣으면 다 깨집니다. */
  console.log('\n── ⑤ 도판이 뜨는가 · 더 작은 것이 있는가');
  const one = rows0.find((r) => r.thumbUrl || r.detailThmbUrl);
  if (one) {
    const base = String(one.thumbUrl || one.detailThmbUrl).trim();
    const cur = (/thumbSe=([^&]*)/.exec(base) || [])[1] || '(없음)';
    console.log(`   지금 크기값 thumbSe=${cur}`);
    for (const se of [cur, 'b_thumb', 's_thumb', 'm_thumb', 'l_thumb']) {
      if (!se || se === '(없음)') continue;
      const u = base.replace(/thumbSe=[^&]*/, 'thumbSe=' + se);
      let msg = '?';
      try {
        const rr = await fetch(u, { headers: { 'User-Agent': UA } });
        const ct = rr.headers.get('content-type') || '';
        const b = await rr.arrayBuffer();
        const ok = rr.ok && /image/.test(ct) && b.byteLength > 3000;
        msg = ok ? `뜸 ✔ ${(b.byteLength / 1024).toFixed(0)}KB`
                 : `안 뜸 ✕ HTTP ${rr.status} ${(b.byteLength / 1024).toFixed(0)}KB`;
      } catch (e) { msg = '✕ ' + String(e.message).slice(0, 40); }
      console.log(`     thumbSe=${se.padEnd(10)} ${msg}`);
    }
  }

  console.log('\n   ── 세 점을 그대로 불러 봅니다');
  for (const r of rows0.slice(0, 3)) {
    const u = String(r.thumbUrl || r.detailThmbUrl || '').trim();
    if (!u) { console.log('   ✕ 주소 없음 — ' + (r.orginSj || '')); continue; }
    let s = '?';
    try {
      const rr = await fetch(u, { headers: { 'User-Agent': UA } });
      const ct = rr.headers.get('content-type') || '';
      const b = await rr.arrayBuffer();
      s = (rr.ok && /image/.test(ct) && b.byteLength > 3000)
        ? `뜸 ✔ ${(b.byteLength / 1024).toFixed(0)}KB`
        : `안 뜸 ✕ HTTP ${rr.status}`;
    } catch (e) { s = '✕ ' + String(e.message).slice(0, 50); }
    console.log(`   [${s}] ${String(r.orginSj || '').slice(0, 30)} — ${String(r.authorListNm || '')}`);
  }

  /* ⑥ 어떤 태그가 오나 · 몇 건이 미술 작품인가 */
  console.log('\n── ⑥ 라이선스마다 <b>따로</b> 세어 봅니다 (각 200줄 표본)');
  console.log('   ★ 앞 판은 다섯을 뭉쳐 세어 0% 가 나왔습니다.');
  console.log('     최신순이라 디자인 소재가 목록을 다 차지했기 때문입니다.\n');

  for (const code of ['97', '98', '01', '21']) {
    const L = LICENSE[code];
    let all = 0, art = 0, tot = 0;
    const tagCnt = new Map();
    const good = [];
    try {
      const j2 = await getJSON(url(1, 200, code));
      tot = totalOf(j2);
      for (const r of rowsOf(j2)) {
        all++;
        if (isArtwork(r)) { art++; if (good.length < 5) good.push(r); }
        for (const t of String(r.tagNmList || '').split(',')) {
          const k = t.trim();
          if (k && k.length < 16) tagCnt.set(k, (tagCnt.get(k) || 0) + 1);
        }
      }
    } catch (e) { console.log(`   ${code} (못 셈 — ${String(e.message).slice(0, 50)})`); continue; }

    const pct = all ? Math.round(art / all * 100) : 0;
    console.log(`   ── ${code} ${L.nm} · 모두 ${tot.toLocaleString()}건`);
    console.log(`      표본 ${all}줄 가운데 미술 작품 ${art}줄 (${pct}%)`
              + ` → 대략 ${Math.round(tot * (all ? art / all : 0)).toLocaleString()}건쯤`);
    const top = [...tagCnt.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
    console.log('      흔한 태그: ' + top.map(([t, n]) => `${t}(${n})`).join(' · '));
    for (const g of good)
      console.log(`        ▸ ${String(g.orginSj || '').slice(0, 26).padEnd(28)}`
                + ` ${String(g.authorListNm || '').slice(0, 18)}`);
    console.log('');
  }

  /* ⑦ 제공처 거르개 — 안 먹는 것을 확인해 둡니다 */
  console.log('\n── ⑦ 제공처 거르개 (2026-08-23 · <b>안 먹는 것을 확인</b>)');
  for (const [nm, cd] of [['한국미술정보센터', '01'], ['국립중앙박물관', '38'],
                          ['문화재청', '33'], ['국립민속박물관', '32'],
                          ['한국고전번역원', '03'], ['한국미술협회', '44']]) {
    let n = null;
    try { n = totalOf(await getJSON(url(1, 1) + '&searchSrcTrgetInttCd=' + cd)); } catch (e) { }
    console.log(`   ${nm.padEnd(16)} ${n == null ? '(못 셈)' : n.toLocaleString() + '건'}`);
  }
  console.log('   ★ 위 수가 전체(87,705)와 같으면 <b>제공처 거르개가 안 먹는 것</b>입니다.');

  console.log('\n──────────────────────────────');
  console.log('★ 도판이 뜨고 작은 크기가 있으면 바로 담습니다.');
  console.log('  지금은 담지 않았습니다.');
}

/* ══ 돌리기 ══════════════════════════════════════════════════════ */
(async () => {
  if (PEEK) { await peek(); return; }

  console.log(`▶ 공유마당 수집 · 미술·이미지 · 라이선스 ${USE.join(',')}`
    + ` · limit=${LIMIT}${DRY ? ' · 세어만 봅니다' : ''}`);

  let byName = new Map();
  try { byName = await loadArtists(); } catch (e) { }
  console.log(`  작가 이름 ${byName.size}개를 담아 두었습니다\n`);

  let got = 0, kept = 0, put = 0, skipLic = 0, skipOut = 0, thin = 0, auto = 0;
  const errs = [];

  for (let p = 1; got < LIMIT; p++) {
    let j = null;
    try { j = await getJSON(url(p, PAGE)); }
    catch (e) {
      if (isStop(e)) { console.log('  ■ 멈춥니다 — ' + stopReason(e)); break; }
      errs.push(`page ${p}: ${e.message}`);
      if (errs.length > 3) break;
      continue;
    }
    const rows = rowsOf(j);
    if (!rows.length) break;                       /* ★ 0줄일 때 끝냅니다 */
    const total = totalOf(j);

    const out = [];
    for (const o of rows) {
      got++;
      const before = kept;
      const w = build(o, byName);
      if (!w) {
        const code = String(o.licenseCd || '').padStart(2, '0');
        if (!LICENSE[code] || !LICENSE[code].ok) skipLic++;
        else if (!isArtwork(o)) skipOut++;
        else thin++;
        continue;
      }
      kept++;
      if (w.link_status === 'auto') auto++;
      out.push(w);
    }

    if (!DRY && out.length) {
      const res = await upsert(out);
      if (res.msg) { errs.push(res.msg); if (errs.length > 3) break; }
      else put += res.ok;
    }
    console.log(`  ${got}/${total || '?'} · 담을 것 ${kept}${DRY ? '' : ` · 담음 ${put}`}`);
    if (total && got >= total) break;
  }

  console.log('──────────────────────────────');
  console.log(`  받은 것            ${got}`);
  console.log(`  라이선스가 안 맞아 뺌 ${skipLic}`);
  console.log(`  미술 작품이 아니라 뺌 ${skipOut}`);
  console.log(`  얇아서 뺀 것        ${thin}`);
  console.log(`  담을 만한 것        ${kept}`);
  console.log(`  작가와 이어짐       ${auto}`);
  if (!DRY) console.log(`  실제로 담음         ${put}`);
  if (errs.length) {
    console.log(`  ★ 문제 ${errs.length}건`);
    errs.slice(0, 3).forEach((m) => console.log('     · ' + m));
  }
})();
