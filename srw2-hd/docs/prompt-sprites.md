你是执行 agent。先读 `docs/brief-sprites.md`，再读 `docs/README.md` 的所有权约定。

任务：实现 `tools/extract_sprites_chr.py`，从官方地图 + CHR 提取每台机体的原版 16×16 图标，
输出到 `assets/hd/units-gen/` 并写 `data/sprites-chr.json`。
只允许写 brief 里列出的文件；不要改 `config/units.js`、`config/scenarios.js`、`src/*`。
不要起常驻服务器。Python 3 + PIL + numpy 可用。

必须自己跑脚本、贴真实输出、报告成功/失败清单与原因。
