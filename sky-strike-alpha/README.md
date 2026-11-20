# SKY STRIKE ALPHA

> 天穹突击·阿尔法 — 霓虹街机横版飞行。按住爬升，松开俯冲，穿越能量闸门与陨石阵，收集能量核心，把跃迁充能耗尽即过关。

## 运行

```bash
cd sky-strike-alpha
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建零依赖：`index.html` + ES Module，无 CDN/外链/素材文件；美术全程序化 Canvas，音频纯 WebAudio。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 爬升 | 按住 Space / ↑，或按住屏幕 |
| 俯冲 | 松开 |
| 暂停 / 继续 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏的下拉可切 **中文**。
- `?lang=zh` / `?lang=en` 可临时覆盖；选择写入 localStorage（`sky-strike-alpha-lang`）。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh 完整。

## 门禁（全部自跑绿）

```bash
node --test                                                      # 17 条测试
node tools/selfplay.mjs                                          # greedy/random/noinput → tools/fun/autoplay.json
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
config/             配置与文案（game.config.js / levels.js / locales.js / design.json / sdk.config.js）
src/core/           i18n、存档、SDK、音频
src/game/           sim（纯逻辑）+ autopilot（贪心自动驾驶）
src/render/         Canvas 程序化渲染
src/ui/             UI 模块
src/main.js         主入口（60Hz 固定步长装配）
tests/              测试
tools/              工具与验收计划（selfplay / audio-check / verify.plan）
tools/fun/          设计审计 / 玩测遥测 / 视觉评审产出
```

## 调试契约

`window.__ll` 暴露标准调试接口：`state.phase`、`start/pause/resume/restart`、`run`、`tutorial`、`startTutorial`、`save/load/share`、`debug`（`partialFly` / `autoFly` / `startSeeded` / `loadLevel` 等）。
