# WORD TRAILS · 单词接龙

字母环形拼词益智游戏（Words of Wonders 式）。每关给一组字母环与若干隐藏单词，拖动字母拼词，命中即揭示；找全所有单词过关。16 关，难度从 3 字母递增到 5 字母。

- 品类：文字词汇 / 益智（环形拼词）
- 参考：Words of Wonders（只借鉴品类，词库与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 2D · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/word-trails
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 鼠标 / 触屏：在字母环上**按住一个字母并拖过其它字母**拼词，松手提交。发光轨迹跟随手指。
- `Hint`：揭示某个未找到词的一个字母（每关 3 次）。
- `Shuffle`：重排字母环，帮助发现新拼法。
- `Esc` / `P` 暂停；窗口失焦自动暂停。

## 规则与计分

- 拼对目标词：`字母数 × 10` 分；连续拼对额外 `5 × (streak-1)` 连击奖励。
- 拼错 / 太短 / 已找到：分别提示，错词重置连击。
- 找全所有词过关；按提示用量评星（0 提示=3 星）。
- 进度（已解锁关卡 / 最佳分 / 星级）自动存档。

## 测试与验收

```bash
node --test                                                   # 13 条纯逻辑测试（含词库正确性）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config / levels（16 关词库）/ locales / sdk.config
src/game/    sim.js（纯逻辑：拼词判定/提示/重排/计分，可注入 seed）
src/render/  index.js（词面板/字母环轨迹/反馈粒子）
src/ui/      ui.js（标题/暂停/过关 + HUD + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|clear；`start/pause/resume/restart`；
`debug.state()` / `debug.submit(word)` / `debug.hint()` / `debug.shuffle()` / `debug.setLevel(n)` / `debug.solveLevel()`。

## 国际化

仅 `en`（默认）+ `zh`；词库为英文单词（玩法本体），界面文案双语。