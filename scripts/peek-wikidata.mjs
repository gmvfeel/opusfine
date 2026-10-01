const UA = 'OpusfineBot/1.0 (https://opusfine.vercel.app; cser@wixon.co.kr)';

async function run(label, q) {
  const url = 'https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
    const t = await r.text();
    console.log('── ' + label + ' · status ' + r.status + ' ──');
    console.log(t.slice(0, 3000));
  } catch (e) { console.log('── ' + label + ' 실패: ' + e.message); }
  console.log('');
}

(async () => {
  // 1) 한국(Q884) 조직 중 이름에 "미술"이 들어간 것 — 분류를 못박지 않고 넓게
  await run('이름에 "미술" 포함 · 한국 조직', `
    SELECT ?item ?itemLabel ?instanceLabel WHERE {
      ?item wdt:P17 wd:Q884 .
      ?item rdfs:label ?lbl . FILTER(CONTAINS(?lbl, "미술") && LANG(?lbl) = "ko")
      OPTIONAL { ?item wdt:P31 ?instance }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
    } LIMIT 60`);

  // 2) 한국미술협회 자신의 항목과 P31(instance of) 값
  await run('"한국미술협회" 자체 항목 찾기', `
    SELECT ?item ?itemLabel ?instance ?instanceLabel WHERE {
      ?item rdfs:label "한국미술협회"@ko .
      OPTIONAL { ?item wdt:P31 ?instance }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
    } LIMIT 10`);

  // 3) Q20897549(art institution) 로 못박고 한국(Q884) 전체를 셉니다
  await run('P31=art institution(Q20897549) · 한국 전체 개수', `
    SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
      ?item wdt:P31 wd:Q20897549 .
      ?item wdt:P17 wd:Q884 .
    }`);

  // 4) 같은 조건으로 목록까지 (최대 100)
  await run('P31=art institution(Q20897549) · 한국 전체 목록', `
    SELECT ?item ?itemLabel ?inception ?website WHERE {
      ?item wdt:P31 wd:Q20897549 .
      ?item wdt:P17 wd:Q884 .
      OPTIONAL { ?item wdt:P571 ?inception }
      OPTIONAL { ?item wdt:P856 ?website }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". }
    } LIMIT 100`);
})();
