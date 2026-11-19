# MYSTIC TOWER RISE

> 霓虹高塔 — 攀上霓虹之塔：算好每一战，抢光每一层。

一款纯前端的魔塔式网格爬塔游戏（玩法骨架 1:1 保留经典魔塔：确定性战斗公式 / 钥匙门 / 宝石药水 / 商店 / 楼梯），主题换皮为霓虹街机，并新增三个机制：**完美连击（无伤击杀金币翻倍）/ 能量水晶 + 磁能镐 / 传送星门**。

## 运行

```bash
cd mystic-tower-rise
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键/操作 |
| --- | --- |
| 移动/交互 | 点击地图格子 |
| 暂停 | Esc / P |
| 重开本层 | R |
| 静音 | M |

## 语言

- 默认英文；标题右上角 / 暂停屏可切中文。
- `?lang=zh` 可临时覆盖；选择写入 localStorage。

## 测试与验收

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
config/             配置 / 文案 / 地图数据 / SDK 配置 / 设计源
src/core/           i18n / 存档封装 / 音频 / SDK 出口
src/game/           纯逻辑（sim / bot）
src/render/         Canvas 程序化渲染
src/ui/             UI 屏幕与多语言
src/main.js         主入口
src/vendor/         本地 pipysdk
tests/              单元测试
tools/              自对弈 / 验收计划 / 音频验收
```
