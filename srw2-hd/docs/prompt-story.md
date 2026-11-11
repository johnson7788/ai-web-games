你是执行 agent。先读 `docs/brief-story.md`，再读 `docs/README.md` 的所有权约定。

任务：抓取 adventureisland.org 的 SRW2 会話データ（kw0..kw27），翻译成中文，
产出 `data/script-ja.json` 与 `data/script-zh.json`，并写一个只读的 `tools/scrape_script.py`。
只允许写 brief 里列出的文件；不要改 `config/scenarios.js`、`src/main.js`、`tests/sweep.py`。
不要起常驻服务器。

必须保留说话人、场景标题、逐行文本；不得编造台词。贴抓取页数/行数/翻译覆盖率。
