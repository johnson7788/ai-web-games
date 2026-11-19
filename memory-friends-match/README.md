# MEMORY FRIENDS MATCH

> 记忆找朋友 · Neon Memory Arcade

霓虹街机记忆配对：记住每位机器朋友的样子与名字，倒计时内连续答对「名字↔样子」的配对，用连击与星级把记忆变成街机高分挑战。

## 运行

```bash
cd games/memory-friends-match
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 |
| --- | --- |
| 点「我记住了」进入答题 | 鼠标 / 触屏 |
| 选择答案 | 鼠标 / 触屏 |
| 扫描提示（移除一个错误选项） | HUD 💡 |
| 暂停 / 恢复 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新保留。

## 测试 / 验收

```bash
node --test                                 # ≥10 断言
node tools/selfplay.mjs                     # greedy/random/noinput → tools/fun/autoplay.json
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
config/             关卡数值 / 文案 / 设计源 / SDK 配置
src/core/           i18n / 存档 / SDK / 程序化音频
src/game/           纯逻辑 sim（Node 可测）
src/render/         霓虹背景 canvas + 朋友 SVG 生成
src/ui/             DOM UI
src/main.js         主入口（60Hz 固定步长装配）
tests/              测试
tools/              自对弈 / 验收计划 / 音频验收 / 海报截图
```
