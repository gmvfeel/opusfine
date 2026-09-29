/* ══════════════════════════════════════════════════════════════════
   OPUSFINE · 가벼운 CSV 읽개 · scripts/lib/csv.mjs
   ------------------------------------------------------------------
   ★ 이 프로젝트 수집 스크립트는 외부 패키지를 안 씁니다(node 만으로
     돕니다 · GitHub Actions 에 npm install 단계가 없습니다). 그래서
     csv-parse 같은 라이브러리 대신 <b>직접</b> 짭니다.

   ★★ 콤마로만 자르면 안 됩니다. 내셔널갤러리 데이터는 provenance 같은
     칸에 <b>줄바꿈과 콤마가 든 채로 따옴표(")</b>에 싸여 옵니다.
     문자 하나씩 보는 상태기계라야 이런 칸도 옳게 잘립니다.
   ══════════════════════════════════════════════════════════════════ */
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++; continue;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* 파일을 읽어 {idx, rows} 로 돌려줍니다. idx 는 「칸이름→자리」,
   rows 는 머리글을 뺀 낱줄 배열(각 줄도 배열)입니다. */
export function readCSV(fs, file) {
  const text = fs.readFileSync(file, 'utf8');
  const all = parseCSV(text);
  const header = all[0] || [];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  return { idx, rows: all.slice(1) };
}
