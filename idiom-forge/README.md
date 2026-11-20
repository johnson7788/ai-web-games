# IDIOM FORGE · 成语熔炉

> Fill the missing characters. Forge the blade. — 补全成语，锻造成刃。

改造自「成语拼拼」（Cocos Creator 源码，见 `docs/analysis.md`）。玩法规则 1:1 还原（spec P0），角色/场景/音乐全原创，零构建纯静态 + 零运行期依赖（唯一例外站点 SDK）。

## 一句话

你是成语熔炉的学徒：看着缺字的成语与释义，从候选字格里点选补全；答对连击得分并把成语锻进兵器，答错的字落进炉渣，集满三渣熔炼成提示。

## 运行

```bash
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键/触屏 |
| --- | --- |
| 点选候选字格填字 | 鼠标点击 / 触屏点击 |
| 提示（亮出正确字） | 点 Hint（或 3 炉渣熔炼） |
| 重置（换一题） | 点 Reset |
| 暂停 / 继续 | Esc / P |
| 重开 | R（结算屏） |

## 语言

默认英文；右上角下拉可切中文（`?lang=zh` 临时覆盖；选择写 localStorage，刷新保留）。只暴露 en/zh。

## 核心系统

- 缺字填空：成语（中文 4 字）或英文 4 字母单词，缺 1–2 字，候选字格点选补全。
- 连击计分：连续答对每层 +50；答错扣时并把错字丢进炉渣（3 渣 = 1 提示）。
- 铸兵器：每答对 5 题铸 1 件神兵（12 件套：剑/刀/弓/枪/斧/锤/戟/鞭/棍/盾/弩/钺）。
- 字谜双轨：约 30% 概率出「字谜模式」，看谜面猜字，分 ×2。
- 三场景包：铁匠铺（暖橙）→ 书院（青竹）→ 天工阁（金紫）。
- 12 关推进：题量 8→12、计时收紧、缺字数 1→2、字格 8→14。

## 契约（事件 / 接口）

见 `docs/report.md` 与 `tests/*.test.mjs`。调试口：`window.__ll`（`state.phase / lang / setLang / start / pause / resume / restart / tutorial / save / ui / debug.layout()`）。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/{fun-report,fun-audit,verify-game,i18n-check,tutorial-check,sdk-check,vision-review}.mjs --root .
node tools/audio-check.mjs
```
