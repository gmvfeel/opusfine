#!/usr/bin/env python3
# ══════════════════════════════════════════════════════════════════
# OPUSFINE · tools/tagcheck.py — HTML 태그 짝 검사
# ------------------------------------------------------------------
# ★★ 2026-08-23 · <b>같은 잘못을 두 번 했습니다.</b>
#   화면에서 견본 덩이를 잘라 낼 때 그 묶음의 닫는 태그까지 지워야
#   하는데 <b>짝 없는 </div> 를 남겼습니다.
#     · db/artist-view.html — 「같은 시대 작가」 초상이 원본 크기로 터짐
#     · db/work-view.html   — 전시 이력 아래가 밀림
#   .wrap 이 미리 닫혀 아래 내용이 통째로 바깥으로 튀어나갑니다.
#
# ★ 앞서 쓰던 검사는 <b>「안 닫힌 태그」만</b> 셌습니다.
#   <b>「짝 없는 닫는 태그」</b>는 못 잡았습니다. 둘 다 세야 합니다.
#
# 쓰는 법
#   python3 tools/tagcheck.py                 (모든 html)
#   python3 tools/tagcheck.py db/work-view.html
# ══════════════════════════════════════════════════════════════════
import io, sys, glob
from html.parser import HTMLParser

VOID = {
    'meta', 'link', 'br', 'img', 'input', 'hr', 'source', 'area', 'base',
    'col', 'embed', 'param', 'track', 'wbr',
    # SVG 안쪽 — 스스로 닫는 것이 많습니다
    'path', 'rect', 'circle', 'use', 'line', 'polygon', 'polyline',
    'ellipse', 'stop', 'animate', 'feoffset', 'fegaussianblur'
}


class Check(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []      # 열려 있는 것
        self.extra = []      # ★ 짝 없는 닫는 태그

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        pass                 # <br/> 처럼 스스로 닫은 것

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if self.stack and self.stack[-1][0] == tag:
            self.stack.pop()
        elif any(x[0] == tag for x in self.stack):
            # 안쪽 것이 안 닫힌 채 바깥이 닫힘 — 거기까지 걷어 냅니다
            while self.stack and self.stack.pop()[0] != tag:
                pass
        else:
            self.extra.append((tag, self.getpos()[0]))


def check(path):
    p = Check()
    try:
        p.feed(io.open(path, encoding='utf-8').read())
    except Exception as e:
        return path, ['읽기 오류 ' + str(e)]
    bad = []
    for t, ln in p.stack:
        bad.append(f'안 닫힘  <{t}>  {ln}행')
    for t, ln in p.extra:
        bad.append(f'★짝 없는 닫는 태그  </{t}>  {ln}행')
    return path, bad


def main():
    args = sys.argv[1:]
    files = args if args else sorted(glob.glob('**/*.html', recursive=True))
    files = [f for f in files if 'node_modules' not in f]
    bad_n = 0
    for f in files:
        path, bad = check(f)
        if bad:
            bad_n += 1
            print(f'★ {path}')
            for b in bad:
                print('    ' + b)
        else:
            print(f'✔ {path}')
    print('──────────────────────────────')
    print(f'  {len(files)}개 가운데 {bad_n}개에 문제가 있습니다.'
          if bad_n else f'  {len(files)}개 모두 깨끗합니다.')
    sys.exit(1 if bad_n else 0)


if __name__ == '__main__':
    main()
