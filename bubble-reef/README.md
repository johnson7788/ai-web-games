# BUBBLE REEF

> 发光水母泡泡龙 · 珊瑚礁三场景 · 12 关推进

改造自泡泡龙（Cocos 源码见 `docs/analysis.md`），玩法 1:1 还原 + 原创美术/音频/三场景包。

## 运行

```bash
cd games/bubble-reef
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建、零运行期依赖（唯一例外站点 SDK，本地 vendored 降级可玩）。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 瞄准 | 移动鼠标 / 拖动手指 |
| 发射 | 点击 / 松手（或 Space） |
| 百搭泡 | W / 点按左下按钮（耗 3 连击） |
| 潮汐瞄准线 | P / 点按右下按钮（每关 1 次） |
| 暂停 | Esc |
| 重开 | R |

## 玩法

同色 ≥3 连通消除；失去支撑的整簇悬空泡掉落额外分；顶棚每 N 发下沉一行；触底判负；每关目标清除率通关。
连击攒满 3 换一颗任意色百搭泡。12 关跨浅礁 / 夜礁 / 沉船，加入岩礁障碍泡、移动洋流、双层顶棚、五色关、金泡必消。

## 门禁

```bash
/opt/homebrew/bin/node --test
/opt/homebrew/bin/node tools/selfplay.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
/opt/homebrew/bin/node tools/audio-check.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

全绿结果见 `docs/report.md`。
