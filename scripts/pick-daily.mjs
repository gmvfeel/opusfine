#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · SELF PR · 이달의 미술학교 자동 선정
   scripts/pick-daily.mjs · 2026-10-01

   오퍼스클램(scripts/pick-daily.mjs)의 틀을 그대로 가져왔습니다 —
   「화면이 실제로 보여주는 것」에 점수를 매겨 매일 사람 한 명,
   매달 학교 한 곳을 고르는 방식입니다. 칸 이름만 오퍼스파인
   자료에 맞췄습니다(persons→artists, description→bio,
   person_works→artworks, departments→depts, estab_type→founder_type).
   person_awards 에 대응하는 표가 오퍼스파인에는 없어 그 부분은 뺐습니다.

   ① daily_self_pr — 날마다 작가 한 명을 골라 담습니다
   ② monthly_school — 달마다 미술학교 한 곳을 골라 담습니다
   둘 다 이미 담긴 날·달은 건너뜁니다. 여러 번 돌려도 안전합니다.
   손으로 쓴 것(is_manual=true)은 덮어쓰지 않습니다.

   쓰는 법
     node scripts/pick-daily.mjs                    오늘·이번 달 (없으면 담기)
     node scripts/pick-daily.mjs --fill-past=15      15일 전부터 오늘까지 메우기
     node scripts/pick-daily.mjs --ymd=2026-10-01    그 날만
     node scripts/pick-daily.mjs --ym=2026-10        그 달만
     node scripts/pick-daily.mjs --only=person        작가만 (school 이면 학교만)
     node scripts/pick-daily.mjs --dry               담지 않고 무엇을 고를지만 보기

   ★ 날짜는 한국 시각 기준입니다.
   ★ Supabase 한 번에 200줄 상한 — sbAll() 로 이어 받습니다.
   ══════════════════════════════════════════════════════════════════ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const UA = 'opusfine-internal/pick-daily (https://opusfine.vercel.app)';

const ARGS = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true];
  })
);
const DRY       = !!ARGS.dry;
const FILL_PAST = /^\d+$/.test(String(ARGS['fill-past'])) ? Number(ARGS['fill-past']) : 0;
const ONE_YMD   = /^\d{4}-\d{2}-\d{2}$/.test(String(ARGS.ymd)) ? String(ARGS.ymd) : null;
const ONE_YM    = /^\d{4}-\d{2}$/.test(String(ARGS.ym)) ? String(ARGS.ym) : null;
const ONLY      = ARGS.only === 'person' || ARGS.only === 'school' ? ARGS.only : null;

const KST_MS = 9 * 3600 * 1000;
function kstYmd(offsetDays = 0) {
  const t = Date.now() + KST_MS - offsetDays * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}
const TODAY = kstYmd(0);
const THIS_YM = TODAY.slice(0, 7);

const HDR = {
  'User-Agent': UA, apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json',
};

async function sbGet(path) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, { headers: HDR });
  if (!r.ok) throw new Error('GET ' + path + ' → ' + r.status + ' ' + (await r.text()));
  return r.json();
}

async function sbAll(path, cap = 80000) {
  const out = [];
  let from = 0;
  for (let guard = 0; guard < 1000; guard++) {
    const r = await fetch(SB_URL + '/rest/v1/' + path, {
      headers: { ...HDR, 'Range-Unit': 'items', Range: from + '-' + (from + 199) },
    });
    if (!r.ok) throw new Error('GET ' + path + ' → ' + r.status + ' ' + (await r.text()));
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    out.push(...rows);
    from += rows.length;
    if (out.length >= cap) break;
  }
  return out;
}

async function sbInsert(table, row) {
  const r = await fetch(SB_URL + '/rest/v1/' + table, {
    method: 'POST', headers: { ...HDR, Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error('POST ' + table + ' → ' + r.status + ' ' + (await r.text()));
  return r.json();
}

const has = (v) => typeof v === 'string' && v.trim() !== '';
const len = (v) => (has(v) ? v.trim().length : 0);

/* ════════════════════════════════════════════════════════════
   ① 오늘의 SELF PR (작가)
   ════════════════════════════════════════════════════════════ */

function scorePerson(p) {
  let s = 0;
  const ko = len(p.bio), en = len(p.bio_en);

  if (ko >= 400) s += 44; else if (ko >= 200) s += 34;
  else if (ko >= 100) s += 24; else if (ko >= 40) s += 14;

  if (en >= 400) s += 20; else if (en >= 200) s += 15;
  else if (en >= 100) s += 10; else if (en >= 40) s += 5;

  if (has(p.field))       s += 4;
  if (has(p.genre))       s += 3;
  if (has(p.nationality)) s += 3;
  if (has(p.life))        s += 3;
  if (has(p.era_name))    s += 2;
  if (has(p.school))      s += 3;
  if (has(p.rep_work))    s += 5;

  if (/^https?:\/\//.test(p.link_wiki || '')) s += 4;
  if (/^https?:\/\//.test(p.link_home || '')) s += 4;
  if (has(p.image_url))   s += 6;
  return s;
}

async function pickPersons() {
  const hist = await sbAll('daily_self_pr?select=ymd,artist_id,is_manual&order=ymd.asc');
  const doneYmd = new Set(hist.map((r) => r.ymd));
  const usedAid = new Set(hist.map((r) => r.artist_id).filter(Boolean));

  let days = [];
  if (ONE_YMD) days = [ONE_YMD];
  else if (FILL_PAST > 0) { for (let i = FILL_PAST - 1; i >= 0; i--) days.push(kstYmd(i)); }
  else days = [TODAY];
  days = days.filter((d) => !doneYmd.has(d));

  if (!days.length) { console.log('[SELF PR] 채울 날이 없습니다.'); return; }
  console.log('[SELF PR] 채울 날 ' + days.length + '일 : ' + days[0] + ' ~ ' + days[days.length - 1]);

  const SEL = 'id,name_ko,name_en,field,genre,nationality,life,era_name,school,rep_work,' +
              'bio,bio_en,image_url,link_wiki,link_home';
  const people = await sbAll('artists?select=' + SEL +
    '&hidden=not.is.true&kind=eq.person&or=(bio.not.is.null,bio_en.not.is.null)&order=id.asc');
  console.log('  소개문이 있는 작가 ' + people.length + '명');

  let cand = people.filter((p) =>
    has(p.name_ko) && has(p.image_url) &&
    (len(p.bio) >= 40 || len(p.bio_en) >= 40) &&
    !usedAid.has(p.id)
  );
  console.log('  사진·소개문을 갖춘 새 후보 ' + cand.length + '명');
  if (!cand.length) { console.log('  ■ 후보가 없습니다.'); return; }

  cand.forEach((p) => { p._base = scorePerson(p); });
  cand.sort((a, b) => b._base - a._base || a.id - b.id);

  const top = cand.slice(0, Math.max(120, days.length * 4));
  const ids = top.map((p) => p.id);
  const chunk = (arr, n) => arr.reduce((a, v, i) =>
    (i % n ? a[a.length - 1].push(v) : a.push([v]), a), []);

  const wCount = new Map();
  for (const g of chunk(ids, 60)) {
    const inList = '(' + g.join(',') + ')';
    const rows = await sbAll('artworks?select=artist_id&artist_id=in.' + inList +
      '&hidden=not.is.true&order=artist_id.asc');
    rows.forEach((r) => wCount.set(r.artist_id, (wCount.get(r.artist_id) || 0) + 1));
  }
  top.forEach((p) => { p._score = p._base + Math.min(wCount.get(p.id) || 0, 12) * 2; });
  top.sort((a, b) => b._score - a._score || a.id - b.id);

  const queue = top.concat(cand.slice(top.length));
  let qi = 0;
  for (const ymd of days) {
    while (qi < queue.length && usedAid.has(queue[qi].id)) qi++;
    if (qi >= queue.length) { console.log('  ■ 후보가 모자랍니다 — ' + ymd + ' 이후를 비웁니다.'); break; }
    const p = queue[qi++];
    usedAid.add(p.id);

    const row = { ymd, artist_id: p.id, score: Math.round(p._score ?? p._base), is_manual: false, note: '자동선정' };
    console.log('  ' + ymd + '  ' + (p.name_ko || p.name_en) +
                ' (#' + p.id + ' · ' + row.score + '점 · 작품 ' + (wCount.get(p.id) || 0) + ')');
    if (!DRY) await sbInsert('daily_self_pr', row);
  }
  if (DRY) console.log('  (--dry · 담지 않았습니다)');
}

/* ════════════════════════════════════════════════════════════
   ② 이달의 미술학교
   ════════════════════════════════════════════════════════════ */

function scoreSchool(s) {
  let n = 0;
  const d = len(s.description);
  if (d >= 500) n += 40; else if (d >= 250) n += 30;
  else if (d >= 120) n += 20; else if (d >= 40) n += 8;

  if (has(s.image_url))   n += 10;
  if (has(s.location))    n += 5;
  if (has(s.depts))       n += 8;
  if (has(s.alumni))      n += 8;
  if (has(s.features))    n += 6;
  if (has(s.founder_type)) n += 2;
  if (has(s.founded))     n += 2;
  if (has(s.logo_url))    n += 6;
  if (/^https?:\/\//.test(s.link_home  || '')) n += 3;
  if (/^https?:\/\//.test(s.link_wiki  || '')) n += 2;
  if (/^https?:\/\//.test(s.link_video || '')) n += 5;
  return n;
}

async function pickSchool() {
  const hist = await sbAll('monthly_school?select=ym,school_id&order=ym.asc');
  const doneYm  = new Set(hist.map((r) => r.ym));
  const usedSid = new Set(hist.map((r) => r.school_id).filter(Boolean));

  const ym = ONE_YM || THIS_YM;
  if (doneYm.has(ym)) { console.log('[이달의 미술학교] ' + ym + ' 은 이미 담겨 있습니다.'); return; }

  const SEL = 'id,name_ko,name_en,location,founder_type,founded,depts,alumni,' +
              'features,logo_url,image_url,description,link_home,link_wiki,link_video';
  const schools = await sbAll('schools?select=' + SEL + '&hidden=not.is.true&order=id.asc');

  const cand = schools
    .filter((s) => has(s.name_ko) && len(s.description) >= 120 && !usedSid.has(s.id))
    .map((s) => ({ ...s, _score: scoreSchool(s) }))
    .sort((a, b) => b._score - a._score || a.id - b.id);

  console.log('[이달의 미술학교] ' + ym + ' · 새 후보 ' + cand.length + '곳');
  if (!cand.length) { console.log('  ■ 후보가 없습니다.'); return; }

  const s = cand[0];
  console.log('  고름 : ' + s.name_ko + ' (#' + s.id + ' · ' + s._score + '점)');
  console.log('  다음 후보 : ' + cand.slice(1, 4).map((x) => x.name_ko + '(' + x._score + ')').join(' · '));

  if (DRY) { console.log('  (--dry · 담지 않았습니다)'); return; }

  await sbInsert('monthly_school', { ym, school_id: s.id, score: s._score, is_manual: false });
  console.log('  담았습니다.');
}

/* ════════════════════════════════════════════════════════════ */
async function main() {
  console.log('=== pick-daily · 한국시각 ' + TODAY + (DRY ? ' · DRY' : '') + ' ===');
  if (ONLY !== 'school') await pickPersons();
  if (ONLY !== 'person') await pickSchool();
  console.log('=== 끝 ===');
}

main().catch((e) => { console.error('■ 실패:', e); process.exit(1); });
