# M3 执行单：全 26 话剧情台本抓取 + 中文翻译

> 前置：无。只写 `tools/scrape_script.py`、`tools/validate_script.py`、
> `data/script-ja.json`、`data/script-zh.json`、`docs/story-report.md`。
> **禁止**改 `config/scenarios.js`、`src/*`、`tests/sweep.py`。

## 0. 完成定义
- 抓取 `http://www.adventureisland.org/srw2/kw0.html` … `kw27.html`（Shift_JIS）。
- `data/script-ja.json`：包含 prologue(00)、26 话(01..26)、epilogue(27)（有内容就收录）。
- `data/script-zh.json`：同一结构，`lines[].textZh` 为中文；`whoZh` 为中文人名。
- 翻译覆盖率 100%：不能有空行、不能保留日文假名（专有名词/拟声词除外，需在报告里列出）。
- `docs/story-report.md`：逐话行数、说话人映射、术语表、未解决项。

## 1. 数据结构
```json
{
 "00": {
   "title": "プロローグ",
   "lines": [
     {"who": "ブライト", "whoZh": "乔", "text": "…", "textZh": "…"}
   ]
 },
 "...": {}
}
```
- 保留原始 `who`/`text`；中文放 `whoZh`/`textZh`。
- 场景内的 `【第N話】` / `【インターミッション】` 这类标题，作为 `sections` 或 `title` 保留。

## 2. 翻译规则
- 人名/机体名以 `data/unit-sprite-map.json` 的 `name` 与 `data/story.json` 为准：
  ブライト=乔、アムロ=阿姆罗、カミーユ=卡缪、竜馬=龙马、甲児=甲儿、さやか=爱美神、
  フォウ=凤、ジュドー=捷多、ハマーン=哈曼、シロッコ=西洛克、ビアン=比安…
- 台词口语化、短句；不要编造原文没有的信息。
- 每行不超过 ~40 个汉字（适配对话框），超长可拆成多行（保留原意）。
- 同一说话人全篇一致；生成 `data/speaker-map.json`（日文→中文）便于复用。

## 3. 工具
- `tools/scrape_script.py`：可复跑，缓存 HTML 到 `data/.script-cache/`（写入但不要提交）；
  解析出 `script-ja.json`。
- `tools/validate_script.py`：检查 28 个键、逐话行数、空文本、残留假名比例，输出报表。
- 翻译本身可以直接写 JSON（不必依赖付费 API）；如果写批量脚本，不要硬编码密钥。

## 4. 验收命令
```bash
cd /Users/admin/git/webgames/games/srw2-hd
python3 tools/scrape_script.py
python3 tools/validate_script.py
```

## 5. 交付格式
1) 文件清单 2) 命令输出 3) 逐话行数/覆盖率 4) 未做项 5) 最不满意的一处
