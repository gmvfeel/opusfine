#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 미술단체 수집 (공공데이터포털 · 문화예술교육 단체 목록)
   ------------------------------------------------------------------
   자료원: data.go.kr 데이터셋 15156828
     "한국문화예술교육진흥원_문화예술교육 단체 목록" · CSV · 1,410행

   ★★ 지난 조사에서 "data.go.kr 전체가 해외 IP를 막는다"고 적었던 것은
     <b>틀린 결론</b>이었습니다. 당시 www.data.go.kr 의 안내 페이지를
     인증 없이 두드리다 한 번 ConnectTimeoutError 가 난 것을 전체 차단
     으로 넓혀 잡았습니다. 2026-10-01 다시 두드려 보니 fileData.do 도,
     실제 CSV 다운로드 주소(cmm/cmm/fileDownload.do)도 둘 다 200으로
     멀쩡히 열렸습니다 — 파트너가 "오퍼스클램에서도 문제없었다"고
     지적해 재확인하게 됐습니다.

   ★ 파일은 <b>EUC-KR</b> 로 인코딩돼 있습니다(흔한 공공데이터 포맷).
     UTF-8 로 읽으면 글자가 깨집니다 — TextDecoder('euc-kr') 로 받습니다.

   ★ 1,410건은 "문화예술교육" 단체 전체(무용·연극·음악·미술·기타
     섞임)입니다. 활동분야(5번째 칸)에 <b>"미술"</b>이 들어간 573건만
     추려 담습니다 — 순수미술 아카이브라는 오퍼스파인 성격에 맞춥니다.

   쓰는 법
     node scripts/collect-groups-datagokr.mjs --peek
     node scripts/collect-groups-datagokr.mjs --dry
     node scripts/collect-groups-datagokr.mjs
   ══════════════════════════════════════════════════════════════════ */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const PEEK = process.argv.includes('--peek');
const DRY = process.argv.includes('--dry');

if (!SB_URL || !SB_KEY) {
  console.error('★ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.');
  process.exit(1);
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const DL_URL = 'https://www.data.go.kr/cmm/cmm/fileDownload.do'
  + '?atchFileId=FILE_000000003570540&fileDetailSn=1&insertDataPrcus=N';
const DETAIL_PAGE = 'https://www.data.go.kr/data/15156828/fileData.do';

function splitCsvLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function shape(no, cols) {
  const [, name, foundedRaw, address, website, fields, region, biz] = cols;
  const founded = Number(String(foundedRaw || '').trim());
  return {
    data_go_no: Number(no),
    name: (name || '').trim() || null,
    founded_year: Number.isFinite(founded) && founded > 1800 && founded < 2100 ? founded : null,
    address: (address || '').trim() || null,
    website: (website || '').trim() || null,
    activity_fields: (fields || '').trim() || null,
    region: (region || '').trim() || null,
    business_fields: (biz || '').trim() || null,
    source: 'datagokr-15156828-20261001',
    hidden: false
  };
}

const COLS = ['data_go_no', 'name', 'founded_year', 'address', 'website',
  'activity_fields', 'region', 'business_fields', 'source', 'hidden'];

async function upsert(rows) {
  if (!rows.length) return { ok: 0, msg: '' };
  const r = await fetch(SB_URL + '/rest/v1/groups?on_conflict=data_go_no'
    + '&columns=' + encodeURIComponent(COLS.join(',')), {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) return { ok: 0, msg: r.status + ' ' + (await r.text()).slice(0, 300) };
  return { ok: rows.length, msg: '' };
}

(async () => {
  console.log('════════════════════════════════════════════════');
  console.log(' OPUSFINE 미술단체 수집 (data.go.kr 15156828)');
  console.log('════════════════════════════════════════════════\n');

  const res = await fetch(DL_URL, { headers: { 'User-Agent': UA, Referer: DETAIL_PAGE } });
  console.log('다운로드 status', res.status);
  if (!res.ok) { console.error('★ 받지 못했습니다.'); process.exit(1); }

  const buf = Buffer.from(await res.arrayBuffer());
  const text = new TextDecoder('euc-kr').decode(buf);
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(lines[0]);
  console.log('헤더:', header.join(' · '));
  console.log('전체 줄 수(헤더 제외):', lines.length - 1, '\n');

  let total = 0, artMatched = 0, kept = 0, created = 0;
  let batch = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    total++;
    if (!(cols[5] || '').includes('미술')) continue;
    artMatched++;

    const row = shape(cols[0], cols);
    if (!row.name) continue;
    kept++;

    if (PEEK) {
      if (kept <= 15) {
        console.log('  · [' + row.data_go_no + '] ' + row.name
          + ' (' + (row.activity_fields || '?') + ' · ' + (row.region || '?') + ')');
      }
      continue;
    }

    batch.push(row);
    if (batch.length >= 20) {
      if (DRY) {
        console.log('  (dry) ' + batch.length + '건 · 누적 ' + kept);
      } else {
        const r = await upsert(batch);
        if (!r.ok && batch.length) console.log('  ✗ 담기 실패: ' + r.msg);
        else created += r.ok;
      }
      batch = [];
    }
  }

  if (batch.length && !PEEK) {
    if (DRY) console.log('  (dry) 마지막 ' + batch.length + '건');
    else {
      const r2 = await upsert(batch);
      if (!r2.ok) console.log('  ✗ 담기 실패(마지막): ' + r2.msg);
      else created += r2.ok;
    }
  }

  console.log('\n════════════════════════════════════════════════');
  console.log(' 전체 ' + total + '건 중 활동분야에 "미술" 포함 ' + artMatched + '건');
  console.log(' 이름까지 있는 것 ' + kept + '건'
    + (PEEK ? ' · 담지 않았습니다(peek)' : ' · 담은 것 ' + created + '건'));
  console.log('════════════════════════════════════════════════');
})();
