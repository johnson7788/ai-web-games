# MAGIC TOWER 50F · 魔塔 50 层

> 霓虹尖塔爬塔 RPG：方格迷宫 + 回合制换血战斗 + 钥匙门 + 装备/灵石 + 连击/星级/机关石三大新机制。
> 零依赖零构建零外链，`python3 -m http.server` 直接可跑。

## 运行

```bash
cd magic-tower-50f
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 移动 | 点击地板格 / 方向键 / WASD |
| 战斗 | 点击怪物 → Fight；Enter 确认 |
| 开门 / 推石头 | 点击门 / 石头 |
| 喝药 | HUD 左上 `+` 按钮 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法

1. 出生在 0 层基地（商店 / 任务 NPC），上楼进入 1-49 层迷宫。
2. 打怪换经验/金币，捡红晶（+攻击）、蓝晶（+防御）、药水、钥匙、武器/盾、灵石。
3. 无伤击杀叠 **连击**（+攻击 / +暴击）；每层按血量/击杀率评 **星级**；推 **机关石** 进坑开宝藏侧路。
4. 清完 50 层、击碎星核即通关。

## 门禁

```bash
node --test
node tools/selfplay.mjs
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
config/             design.json / locales.js / game.config.js / sdk.config.js
src/core/           i18n / sdk / audio（程序化 WebAudio）
src/game/           sim / data / floorgen / astar（纯逻辑，Node 可测）
src/render/         canvas 程序化渲染
src/ui/             UI 屏幕显隐/语言
src/vendor/         pipysdk（本地 vendored，两个外部 fetch 已清空）
tests/              单元测试（node --test）
tools/              selfplay / audio-check / verify.plan.json
```
