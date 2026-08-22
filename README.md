# OPUSFINE

순수미술 아카이브 포털. 작가·작품·전시·전시공간·학교·단체·기관·학술 자료를 모읍니다.

- 오퍼스클램(클래식 음악, opusclam.com)과 같은 구조를 씁니다.
- 자료는 미술관 공개 API와 공공데이터로 날마다 채웁니다. **타 사이트 크롤링은 하지 않습니다.**

## 지금 상태 — 1단계 (화면 뼈대)

| 화면 | 파일 |
|---|---|
| 대문 | `index.html` |
| 작가 목록 | `db/artist.html` |
| 작가 상세 | `db/artist-view.html` |

DB는 아직 붙지 않았습니다. 도판은 메트로폴리탄 공개 API에서 **화면이 직접** 받아 옵니다
(`assets/art-demo.js`). 작품DB가 생기면 그 파일은 지웁니다.

## 짜임

```
index.html              대문
db/artist.html          작가 목록
db/artist-view.html     작가 상세
partials/header.html    위 줄 · 머리 · 전체 메뉴
partials/footer.html    꼬리
assets/of.css           공용 꾸밈 (모든 화면이 이것 하나)
assets/include.js       조각 끼우기
assets/ui.js            전체 메뉴 · 밝게/어둡게
assets/config.js        Supabase 주소·공개키 (한 곳에만)
assets/hero.js          대문 히어로
assets/art-demo.js      도판 견본 (임시)
assets/artist-list.js   목록 캡션 방향
```

## 손댈 때 지킬 것

- 꾸밈은 `assets/of.css` 한 곳에. 화면 안 `<style>`은 그 화면에만 있는 것에만.
- 머리·꼬리는 `partials/`에서 고칩니다. 화면 파일에 적지 않습니다.
- Supabase 주소·키는 `assets/config.js` 한 곳에.
- **service_role 키는 저장소에 두지 않습니다.** GitHub Secrets에만.
- 도판은 우리 저장소에 담지 않고 **미술관 원본 주소를 링크**합니다.

## 자료 쌓기

```
sql/artists-01-B-apply.sql        artists 표 만들기 (한 번만)
scripts/collect-artists.mjs       위키데이터에서 미술가 받아 쌓기
.github/workflows/collect-artists.yml   날마다 새벽 3시 20분
```

손으로 돌릴 때는 Actions → **작가 수집** → Run workflow.

| 무엇 | 받는 것 |
|---|---|
| `kr` | 국적이 한국인 미술가 |
| `kr2` | 한국어 이름이 붙은 미술가 (조선시대 인물을 건지려는 것) |
| `world` | 세계 — 작품이 많이 딸린 순 |

처음에는 **`dry` 를 켜고** 몇 명이 걸리는지 먼저 보십시오.

### 필요한 Secrets

| 이름 | 무엇 |
|---|---|
| `SUPABASE_URL` | 프로젝트 주소 |
| `SUPABASE_SERVICE_KEY` | service_role 키 — **저장소 파일에 두지 않습니다** |

## 다음 단계

3. 목록·상세를 DB에 붙이기
4. 작품DB + 도판 (메트·시카고)
5. 전시 아카이브
