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

## 다음 단계

2. 작가DB 표 + 위키데이터 첫 수집
3. 작품DB + 도판 (메트·시카고)
4. 전시 아카이브
