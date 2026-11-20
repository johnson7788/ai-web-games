# WATER RITUAL · 水之仪式

茶馆经营 + 倒水时机。按住倒水，水位升向刻度线、水温下降；在水位到线且温度落进客人口味区间时松手，杯口绽开「一口回甘」金圈涟漪。

## 运行

```bash
cd games/water-ritual
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建、零运行期依赖（唯一例外站点 pipysdk，本地 vendored + 降级可玩）。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 倒水 | 按住（鼠标 / 手指 / 空格），松手停止 |
| 跳过当前客人 | 触屏右下 `Skip` |
| 暂停 / 继续 | Esc |
| 重开 | 结算后按 R |

## 目录

```
config/          design.json（设计源）、tea.js（玩法数值）、locales.js、sdk.config.js
src/game/sim.js  纯逻辑：倒水物理 / 订单 / 天 / 高峰 / 升级 / 事件
src/render/      程序化 Canvas：三套场景包 + 茶杯水位 + 温度计 + 金圈涟漪
src/ui/          标题 / HUD / 订单票 / 结算 / 升级商店 / 首次引导
src/core/        i18n / sdk / audio（程序化 WebAudio）
src/main.js      装配 + 固定步长 + 状态机 + window.__ll 契约
```

## 验收

```bash
node --test                                              # 20 条纯逻辑测试
node tools/selfplay.mjs                                  # 3 策略遥测
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .   # ≥WARN
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .    # ≥WARN
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .   # ≥WARN
```

全部结果见 `docs/report.md`；源码分析见 `docs/analysis.md`。
