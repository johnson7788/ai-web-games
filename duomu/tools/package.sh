#!/bin/bash
# 打包上线包：给所有模块 URL 打上构建时间戳，绕开 CDN 的 24 小时强缓存。
#
# 为什么需要：pipygames 的静态资源是 `Cache-Control: max-age=86400`，
# 换包后浏览器最多还可能拿一天的旧 JS。index.html 是 no-cache，
# 所以只要让 index.html 引用的入口和它 import 的每个模块 URL 都带 ?v=<stamp>，
# 整张模块图就换成新 URL，缓存立刻失效。
#
# 用法：./tools/package.sh   （产物在仓库根 dist/duomu/duomu.zip）
set -euo pipefail

GAME_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_DIR="$(cd "$GAME_DIR/../.." && pwd)"
STAMP="$(date +%Y%m%d%H%M)"
STAGE="$(mktemp -d)/duomu"
SLUG="duomu"

echo "→ 构建戳 $STAMP"
mkdir -p "$STAGE"
# 只拷运行期需要的东西；tools/tests/docs 由 package_game.py 再过滤一次
rsync -a \
  --exclude 'tools' --exclude 'tests' --exclude 'docs' --exclude 'dist' \
  --exclude '.git' --exclude '*.py' --exclude '*.sh' --exclude '*.md' \
  "$GAME_DIR"/ "$STAGE"/

# 1) 入口脚本
python3 - "$STAGE" "$STAMP" <<'PY'
import re, sys, pathlib
stage, stamp = sys.argv[1], sys.argv[2]
root = pathlib.Path(stage)

html = root / "index.html"
text = html.read_text(encoding="utf-8")
text = re.sub(r'(src="\.?/?src/main\.js)(\?v=[^"]*)?(")',
              lambda m: f'{m.group(1)}?v={stamp}{m.group(3)}', text)
html.write_text(text, encoding="utf-8")

# 2) 每个模块里的相对 import 都带版本号
pat = re.compile(r"""(from\s+['"])(\.[^'"]*\.js)(['"])""")
count = 0
for f in root.rglob("*.js"):
    s = f.read_text(encoding="utf-8")
    new, n = pat.subn(lambda m: f'{m.group(1)}{m.group(2)}?v={stamp}{m.group(3)}', s)
    if n:
        f.write_text(new, encoding="utf-8")
        count += n
print(f"  {count} 个 import 已加版本号")
PY

# 3) 交给平台脚本打包（它负责 SEO.txt / poster.jpg / game.gif / manifest.json）
cd "$REPO_DIR"
python3 skills/upload_games/scripts/package_game.py \
  --dir "$STAGE" --slug "$SLUG" \
  --title "Seize the Log" \
  --categories "Arcade,2 Player,Skill" \
  --tags "arcade,reflex,two-player,mythology,duel,timing" \
  --short "Two immortals, one world tree. Strike the thunder-branded log and you are ash. First to 26 logs wins." \
  --long-file /tmp/duomu-long.md

printf "DONE: dist/%s/%s.zip (stamp %s)\n" "$SLUG" "$SLUG" "$STAMP"
