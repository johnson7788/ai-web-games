# BATTLE ROYALE MINI

> 迷你吃鸡 · 玩具战场 — 缩小版玩具兵在桌面战场（文具/书堆当掩体）缩圈，捡枪吃药，活到最后。

俯视角双摇杆射击 BR：双摇杆（移动+射击方向）、缩圈（圈外掉血）、捡武器/药品/护甲、15 名 AI、击杀计数、最后存活即胜。原创改造：2 格背包取舍（拿医疗丢护甲）、静步（不射击移速 +30% 且不暴露位置）、枪声引 AI、三场景包（书桌暖木/玩具城彩/夜库靛蓝）、决赛圈 1v1 台灯聚光。

## 运行

```bash
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态 + 零运行期依赖（唯一例外站点 SDK，本地 vendored 降级）。

## 操作

| 动作 | 键鼠 | 触屏 |
| --- | --- | --- |
| 移动 | WASD / 方向键 | 左摇杆 |
| 瞄准 | 鼠标 | 右摇杆 |
| 射击 | 按住左键 / 空格 | 按住 FIRE |
| 换弹 | R | 自动 |
| 用药 | Q | 低血自动 |
| 暂停 | Esc / P | — |

## 语言

默认英文，`?lang=` / 标题右上角下拉切换中文；选择持久化，刷新保留。

## 测试与验收

```bash
node --test                                  # 27 条纯逻辑测试
node tools/selfplay.mjs                      # 3 策略遥测 → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
config/         数值 / 文案 / 设计源 / SDK 配置
src/game/       纯逻辑 sim（可测）
src/render/     Canvas 程序化渲染（三场景色板）
src/ui/         UI / HUD / 首次引导
src/core/       i18n / 存档 / 音频 / SDK 出口
tools/          selfplay / audio-check / verify plan / 物料
docs/           分析 / SEO / 复盘
```
