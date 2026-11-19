# KINGDOM RUSH GUARD

> 王国守卫 · 霓虹街机塔防（原创换皮，零依赖零外链，纯 canvas + WebAudio 程序化）

## 运行

```bash
cd games/kingdom-rush-guard
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 建塔 | 点一个发光的六边形建造点，选塔 |
| 升级 / 出售 | 点已建成的塔 |
| 捡能量核心 | 点场上飘落的金色 ◆ |
| 轨道炮大招 | 点 HUD「ORBITAL」按钮 / 按 `O` |
| 暂停 | `Esc` / `P` |
| 重开 | `R` |
| 静音 | `M` |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`kingdom-rush-guard-lang`），刷新后保留。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh 必须完整。
- 自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`。

## 门禁（全自动）

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html          入口
styles.css          样式
poster.jpg          封面（1280×720）
config/             配置与文案（design.json = 机器可读设计源）
src/core/           i18n / sdk / audio
src/game/sim.js     纯逻辑（可无头测试）
src/render/         渲染
src/ui/             UI
src/main.js         主入口
tests/              测试
tools/              验收计划 / selfplay / audio-check / poster
```
