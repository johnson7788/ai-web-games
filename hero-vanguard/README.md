# HERO VANGUARD

> 英雄前哨 · Twin-Hero Station Defense

指挥双子英雄（近战「刃」+ 远程「弓」）守住轨道站，抵御 12 波异星来敌。换位即攻击（换位共鸣）、共鸣斩清场、护盾充能补基地。三场景包：近轨（蓝白）/ 小行星（灰橙）/ 深空（紫黑）。

## 运行

```bash
cd hero-vanguard
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态 + 零运行期依赖（唯一例外：站点 pipysdk，本地 vendored 副本可降级）。

## 操作

| 动作 | 键 | 触屏 |
| --- | --- | --- |
| 移动 | WASD / 方向键 | 左摇杆 |
| 共鸣斩 | J | 右侧 J 按钮 |
| 护盾充能 | K | 右侧 K 按钮 |
| 换位共鸣 | Tab / Q | 右侧 Swap 按钮 |
| 暂停 | Esc / P | — |
| 重新部署 | R（结算后） | 结算按钮 |

## 语言

默认 **英文**；右上角下拉可切 **中文**。`?lang=zh` 可临时覆盖；选择写入 localStorage（`hero-vanguard-lang`），刷新保留。所有可见文案走 `config/locales.js` 的 `t()`；en/zh 完整。

## 测试 / 验收

```bash
node --test                                   # 纯逻辑测试（20 条）
node tools/selfplay.mjs                       # 3 策略 bot 遥测 → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .     # 设计审计
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .    # Fun Gate
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node tools/audio-check.mjs                    # WebAudio 程序化音频 RMS 校验
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root . # 截图视觉评审
```

## 目录

```
index.html          入口
styles.css          样式（letterbox / HUD 不透明条 / #rotate / 移动端）
config/             数值与文案（design.json = 机器可读设计源；gameplay/levels/locales/sdk.config）
src/core/           i18n / save / sdk / audio（程序化 WebAudio）
src/game/           纯逻辑（sim / rng，不碰 DOM）
src/render/         三场景包 Canvas 渲染 + 粒子
src/ui/             屏幕 / HUD / 触屏 / 引导
src/main.js         装配 / 固定步长 / 事件分发 / 状态机 / __ll 契约
assets/             （本作全程序化，无外部素材）
tests/              纯逻辑测试
tools/              selfplay / verify.plan / audio-check / record-gif / make-poster
docs/               analysis / report / SEO
```

## 调试契约

`window.__ll` 暴露标准调试接口：`state.phase` / `lang` / `setLang` / `start` / `startAct` / `pause` / `resume` / `restart` / `tutorial` / `save` / `ui` / `debug.layout()`。

## 存档 / 埋点

只走 `src/core/sdk.js`（`config/sdk.config.js` 为唯一配置源）；业务代码不直接写 localStorage。SDK 缺失/断网自动降级为可玩。
