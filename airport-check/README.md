# AIRPORT CHECK · 机场安检

安检模拟（Papers-Please 式）游戏。你是安检员：核对护照与登机牌、扫描行李 X 光，合规放行、有问题拒绝。三类违规：姓名不符 / 护照过期 / 行李违禁品。三次失误结束班次；每班 8 位旅客，难度递增。

- 品类：模拟经营 / 益智（证件检查）
- 参考：Airport Security / Papers, Please（只借鉴品类，数据与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 证件/X光 + DOM 审批按钮 · 1280×720 letterbox · 程序化 WebAudio

## 运行

```bash
cd games/airport-check
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 读护照（姓名/有效期/国家）、登机牌（姓名/航班/目的地）、行李 X 光（违禁品红色）。
- 点 `Approve` 放行 / `Deny` 拒绝（或按 `A` / `D`）。
- `Esc` / `P` 暂停；窗口失焦自动暂停。

## 规则与计分

- 仅当「姓名一致 + 护照未过期（对比今天 2026-11-13）+ 无违禁品」时放行才正确。
- 正确 +100，连击额外 +10×(combo-1)；错误记一次失误（共 3 次）。
- 每班 8 人；满班过关，下一班违规概率上升（封顶 55%）。最佳分存档。

## 测试与验收

```bash
node --test                                                   # 11 条纯逻辑测试（生成/判定/班次/难度）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（布局/规则/TODAY）/ data（姓名/物品）/ locales / sdk.config
src/game/    sim.js（纯逻辑：旅客生成/放行判定/班次，可注入 seed）
src/render/  index.js（头像/护照/登机牌/X光/印章）
src/ui/      ui.js（标题/暂停/结束/过关 + HUD + 审批按钮 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|over|clear；`start/pause/resume/restart`；
`debug.state()` / `debug.decide(approve)` / `debug.setClean(bool)` / `debug.forceOver()`。

## 国际化

仅 `en`（默认）+ `zh`；证件字段与界面双语（旅客姓名为英文）。