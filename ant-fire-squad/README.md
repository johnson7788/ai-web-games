# ANT FIRE SQUAD

> 火蚁战队 · 霓虹街机风休闲动作游戏

指挥一支火蚁小队：点击投放火种，火蚁自动搬进烈焰熔炉换取热量；在倒计时结束前点燃熔炉（达到目标热量）即可过关。黄蜂会扑向熔炉偷走热量——点击黄蜂投放火兵烧掉它。连续交付叠连击倍率，火花表蓄满触发随机特殊事件（火种雨/加速/金蛋/黄蜂/炸弹）。

## 运行

```bash
cd ant-fire-squad
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零依赖、零构建、零外链：纯静态 `index.html` + ES Module，全部美术程序化 Canvas 绘制，音频纯 WebAudio。

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 投放火种 | 点击/触摸蜂巢 |
| 投放火兵烧黄蜂 | 点击黄蜂 |
| 暂停 / 恢复 | Esc 或 P |
| 重开本关 | R |
| 静音 | M |

## 语言

- 默认 **英文**；右上角下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage 保留。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh 完整。

## 测试与门禁

```bash
node --test                                                    # ≥10 断言
node tools/selfplay.mjs                                        # 三策略 → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
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
poster.jpg          1280×720 海报（标题屏截图）
config/             数值 / 关卡 / 文案 / SDK / design.json
src/core/           i18n / sdk / audio
src/game/sim.js     纯逻辑（Node 可直接 import，供 selfplay/单测）
src/render/         Canvas 程序化渲染
src/ui/             UI（语言/屏幕显隐）
src/main.js         装配 + 状态机 + 教程 + 调试契约
src/vendor/pipysdk.js  本地 vendored SDK（runtimeConfigUrl/appConfigUrl 已清空）
tests/              单元测试 + final 验收截图
tools/              selfplay / audio-check / verify.plan.json
```

## 调试契约

`window.__ll` 暴露：`state{phase,lang}` / `start/pause/resume/restart/home` / `run` / `tutorial{active,step,steps,skip}` / `startTutorial` / `debug{state,fastForward,tap,dropSoldier,forceWin,forceLose,loadLevel}`。
