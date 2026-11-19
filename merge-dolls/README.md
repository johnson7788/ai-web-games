# MERGE DOLLS

> 霓虹合成工厂 · Neon merge factory

放置合成（idle merge）游戏：建造玩偶 → 挂机产金 → 拖拽合成升阶 → 回收换金 → 通关阶段解锁新收藏。

## 运行

```bash
cd merge-dolls
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态，零运行期依赖（无 CDN/外链/素材文件）；美术全部 canvas 程序化，音频纯 WebAudio。

## 操作

| 动作 | 方式 |
| --- | --- |
| 建造玩偶 | 点右侧 BUY 按钮（自动购买当前可负担的最高等级） |
| 合成 | 拖一个玩偶到同款玩偶上 → 升一级 |
| 交换 / 移动 | 拖到不同款 → 交换；拖到空格 → 移动 |
| 回收 | 拖到 RECYCLE 区出售 |
| 击碎故障岩 | 点击岩块（占位 + 奖励金币） |
| 切换收藏 | 顶部 GLOW / PIXEL / STAR 页签（后两者阶段解锁） |
| 暂停 / 重开 | Esc / HUD 按钮 |

## 玩法

- 玩偶每 2s 产金；等级越高产金越多。
- 4s 内连续合成叠加**连击**，提升金币产出。
- 达到最高等级目标通关**阶段**，发奖励 + 解锁新收藏（3 个阶段起）。
- 故障岩每 ~18s 在空格生成（上限 3），点击击碎得金币。

## 语言

- 默认 **英文**，`?lang=zh` 可切中文；标题右上角下拉切换，写入 localStorage。

## 测试 / 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 调试契约

`window.__ll` 暴露 `{ state:{phase,lang}, start, pause, resume, restart, run, tutorial:{active,step,steps,current,skip}, startTutorial, save, ui, debug:{buy,merge,sell,tapRock,maxLevel,state,skipTutorial} }`。
