# BRAIN TEASE · 脑力试炼

> 整蛊实验室：博士发明的 24 个反直觉机关谜题。点错会踩坑，点对会看到博士的魔性吐槽脸。

## 一句话

玩家在博士的整蛊实验室里，用「点、拖、倒置」破解 24 个反直觉机关；答案永远是刁钻互动，过关后博士弹出吐槽。

## 操作

| 动作 | 键鼠 | 触屏 |
| --- | --- | --- |
| 点击物体 | 左键点击 | 轻点 |
| 拖拽物体 | 按住拖 | 按住拖 |
| 倒置场景 | 拖旋转把手 | 拖旋转把手 |
| 提示 | Hint 按钮 | Hint 按钮 |
| 暂停 | Esc / P | 暂停按钮 |

## 运行

```bash
cd games/brain-tease
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 验收门禁（全绿）

```bash
/opt/homebrew/bin/node --test                          # 23 条纯逻辑测试
/opt/homebrew/bin/node tools/selfplay.mjs              # 3 策略遥测
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .   # PASS
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .    # PASS 100/100
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
/opt/homebrew/bin/node tools/audio-check.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .   # PASS
```

## 物料

- `poster.jpg`（1280×720 封面）
- `game.gif`（480×270 列表动画）
- `docs/short` + `docs/long.md`（SEO）
- `docs/analysis.md`（源码分析）+ `docs/report.md`（交付报告）

## 目录

```
index.html / styles.css        入口与样式
config/                        design.json / levels.js(24关) / locales.js / sdk.config.js / game.config.js
src/core/                      i18n / sdk / audio（程序化 WebAudio）
src/vendor/pipysdk.js          站点 SDK（vendored，runtime/app config URL 已清空）
src/game/sim.js                纯逻辑谜题引擎
src/render/                    4 套场景包 + 博士 + 机关道具（程序化 Canvas）
src/ui/                        屏幕 / HUD / 首次引导
src/main.js                    装配 / 固定步长 / 手势 / 状态机 / __ll 契约
tests/                         node:test 纯逻辑测试
tools/                         verify.plan / selfplay / audio-check / record-gif / make-poster / capture-final
```
