# SKY DROP DODGE

> 天降之物·城市风云：举伞跑过高楼天台，躲开花盆/家具/冰箱。能量伞挡小物、挡大物碎伞；借地面风带顺风走位；连续擦身触发慢动作涟漪。

## 运行

```bash
cd sky-drop-dodge
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态 + 零运行期依赖（唯一例外站点 SDK，自动降级可玩）。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 左移 | ← / A · 拖拽 |
| 右移 | → / D · 拖拽 |
| 举伞格挡 | Space · 按住 ☂ 按钮 |
| 暂停 | Esc / P |
| 重开 | R（结算后） |

## 语言

默认英文；右上角 / 暂停屏下拉可切 **中文**（en/zh 完整）。`?lang=` 可临时覆盖，选择写入 localStorage 刷新保留。

## 门禁（全绿）

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
index.html / styles.css   入口与样式
config/                   数值 / 波次 / 文案 / SDK / design.json
src/core/                 i18n / save / sdk / audio（程序化 WebAudio）
src/game/                 sim / spawner / rng（纯逻辑）
src/render/               三场景 / 坠物 / 玩家 / 风带 / 粒子
src/ui/                   屏幕 / HUD / 教程 / 语言
src/main.js               装配 / 固定步长 / 状态机
tests/                    纯逻辑测试 + final 验收截图
tools/                    selfplay / verify / audio-check / capture / record-gif
docs/                     源码分析 / 交付报告 / SEO
```

## 调试契约

`window.__ll`：`state.phase`（boot/title/playing/paused/dead）、`start()`/`pause()`/`resume()`/`restart()`、`run`（当前 sim）、`tutorial.{active,step,steps,current,skip}`、`setLang()`。
