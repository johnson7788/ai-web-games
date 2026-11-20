# CORGI DASH · 柯基冲刺

> 柯基牧羊跑：威尔士草原自动横跑，跳栅栏钻桥洞，收集羊群拉成长链；连续完美跳触发「牧羊冲鸭」，口哨让羊群散开躲障碍。

## 运行

```bash
cd games/corgi-dash
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态、零运行期依赖（唯一例外：站点 pipysdk，本地 vendored 降级可玩）。

## 操作

| 动作 | 键盘 | 触屏 |
| --- | --- | --- |
| 跳（长按变高 / 空中再按二段跳） | Space / W / ↑ | 单击 |
| 吹口哨（羊群散开，8s 冷却） | S / ↓ | 双击 |
| 暂停 / 继续 | Esc / P | — |
| 结算后重跑 | R | 按钮 |

## 规则

- 自动横跑，世界左滚，速度随距离渐增。
- 收集羊群跟在身后形成长链；羊越多分数倍率越高。
- 撞障碍：无羊 → 判负；有羊 → 损失一半羊（口哨散开中无损）。
- 落点与障碍顶部 ≤10px = 完美落点；连续 2 次触发「牧羊冲鸭」奖励。
- 12 段推进 + 三场景包：晨雾草原（青绿）/ 麦浪（金）/ 暴雨山丘（蓝灰）。

## 语言

默认英文，右上角 / 暂停 / 设置可切中文；`?lang=zh` 可临时覆盖，选择持久化。

## 测试与门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/tutorial
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
index.html / styles.css     入口与样式
config/                     数值 / 文案 / design.json / SDK 配置 / 12 段
src/core/                   i18n / sdk / audio（程序化 BGM + SFX）
src/game/                   sim / spawner / rng（纯逻辑）
src/render/                 主题 / 角色 / 粒子 / 装配（程序化 Canvas）
src/ui/                     screens / hud / tutorial / index
src/main.js                 装配 / 固定步长 / 状态机 / 调试契约
tools/                      selfplay / audio-check / verify.plan / record-gif / make-poster
tests/                      纯逻辑测试 + 验收截图
docs/                       analysis / report / short / long
```

## 调试契约

`window.__ll`：`state.phase / lang / setLang / start / pause / resume / restart / run / save / ui / tutorial`。
