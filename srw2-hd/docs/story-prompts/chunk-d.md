你是执行 agent，只做剧情翻译，不改任何游戏代码。

读取 `data/script-ja.json`，翻译以下章节：18, 19, 20。
参考 `tools/translate_script.py` 里的 SPEAKERS / TITLES / SECTIONS，以及其中 ZH["01"]..ZH["08"] 的译文风格（口语化、短句、人名统一）。
只写 `data/script-zh-parts/<章节>.json`，不要改其它文件。

每个输出文件结构：
{"title": "<日文标题>", "titleZh": "<中文标题>", "lines": [
  {"section": "<日文 section>", "sectionZh": "<中文>"},
  {"who": "<日文名>", "whoZh": "<中文名>", "text": "<日文>", "textZh": "<中文>"},
  {"text": "<旁白日文>", "textZh": "<中文>"}
]}

要求：
- 逐行翻译，行数与 ja 完全一致；section 行也要保留。
- 人名/标题优先用 SPEAKERS/TITLES；没收录的按常见译名。
- 不得编造原文没有的信息；不确定时直译。
- 每章写完用 python3 校验：json 可解析、lines 数与 ja 相同、textZh 非空。
- 完成后列出每章行数与文件路径。
