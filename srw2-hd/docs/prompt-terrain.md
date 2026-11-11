你是执行 agent。先读 `docs/brief-terrain.md`，再读 `docs/README.md` 的所有权约定。

任务：实现 `tools/extract_maps_chr.py`，用 CHR tile 精确识别把 26 话地图还原成 `data/maps-chr.json`。
只允许写 brief 里列出的文件；不要改 `config/scenarios.js`、`src/main.js`、`tests/sweep.py`。
不要起常驻服务器。Python 3 + PIL + numpy 可用；ROM 在 `/Users/admin/Documents/Game/fc第二次机器人大战/第二次机器人大战.nes`。

必须自己跑脚本、贴真实输出、报告覆盖率/一致率/未解决项。
