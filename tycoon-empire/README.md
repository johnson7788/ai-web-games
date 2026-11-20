# TYCOON EMPIRE

> 大亨帝国 — 1920 年代银行家放置经营：点击赚钱、买 12 产业、雇佣经理、押注股市日、借杠杆扩张。

## 运行

```bash
cd tycoon-empire
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 操作 |
| --- | --- |
| 点楼产出 | 点击/按住主楼（触屏同） |
| 购买 / 升级 / 雇经理 | 右侧产业面板按钮 |
| 收取收益 | Collect（或 C 键） |
| 股市全押涨/跌 | All In ▲ / ▼ |
| 贷款 / 还贷 | Loan / Repay（或 L 键） |
| 暂停 | Esc |

## 语言

默认 **英文**，右上角下拉可切 **中文**；`?lang=zh` 可临时覆盖。

## 测试与门禁

```bash
node --test                                   # 纯逻辑测试（31 条）
node tools/selfplay.mjs                       # 3 策略遥测
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
index.html          入口
styles.css          样式
config/             配置与文案（design.json = 机器可读设计源）
src/core/           i18n / 存档 / 音频 / SDK 出口
src/game/           纯逻辑经营模拟
src/render/         Canvas 场景渲染（三色板）
src/ui/             标题/HUD/产业面板/引导
src/main.js         主入口（固定步长 + 状态机 + __ll 契约）
tests/              测试与验收截图
tools/              自玩 / 音频校验 / 录制 / 海报 / 验收计划
```

## 调试契约

`window.__ll` 暴露标准接口：`state.phase` / `lang` / `setLang` / `run` / `start` / `pause` / `resume` / `restart` / `save` / `ui` / `debug.layout()` / `debug.advance(sec)`。
