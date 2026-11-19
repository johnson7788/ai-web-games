# WUSHEN SWORD DOME · 武神剑穹

> Neon blade duel arena — 霓虹剑刃对决竞技场（1v1 三连战）。

## 运行

```bash
cd wushen-sword-dome
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键鼠 | 触屏 |
| --- | --- | --- |
| 发射剑刃 1/2/3 | 数字键 1 / 2 / 3 | 点击底部三把剑刃 |
| 技能 1/2 | Q / W（或 A / S） | 点击右侧技能按钮 |
| 闪避 | Space / Shift | 点击金色闪避按钮 |
| 暂停 | Esc | 点击右上 ❚❚ |

## 玩法

- 玩家（左，青）vs 对手（右，粉），各有一条生命（HP）与一条内力（EN）。
- 内力随时间恢复；发射剑刃消耗内力并进入冷却。
- 剑刃沿抛物线飞行，命中对手扣血；同类型剑刃相撞比耐久。
- 剑刃有概率触发技能（中毒 / 多重剑刃 / 暴击）；连击叠高提升伤害，挨打断连击。
- 场中会刷出「星陨石」：核心回血 / 内力核心 / 力量涌动（伤害加成）。
- 连赢三关即征服剑穹；结算按剩余血量 + 最高连击评 1–3 星。

## 语言

- 默认 **英文**；`?lang=zh` 或标题/暂停屏下拉切 **中文**；选择写入 localStorage，刷新保留。
- 文案集中在 `config/locales.js`；en 与 zh 完整平铺。

## 测试 / 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/artifacts
node tools/audio-check.mjs
```

## 目录

```
index.html / styles.css   入口与样式
config/                   数值（balance.js）、文案（locales.js）、设计源（design.json）、SDK 配置
src/core/                 i18n / save / sdk / audio
src/game/sim.js           纯逻辑（可测，无 DOM）
src/render/               Canvas 2D 程序化渲染（霓虹街机）
src/ui/                   DOM UI / HUD / 教程
src/main.js               装配 / 60Hz 固定步长 / 调试契约
src/vendor/pipysdk.js     本地 vendored SDK（外部地址已清空）
tests/                    node:test 纯逻辑测试
tools/                    selfplay / audio-check / verify.plan.json
```

## 调试契约

`window.__ll` 暴露：`state`、`start`、`startTutorial`、`pause`、`resume`、`restart`、`run`、`tutorial`、`save`、`ui`。
