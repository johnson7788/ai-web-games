# 赤色要塞 · RED FORTRESS

> 俯视卷轴载具射击。开一辆吉普冲进敌军要塞，用机枪和手雷撕开防线，
> 把沿途战俘排成一串带回停机坪——救得越多，火力越猛。

**在线玩**：https://pipygames.com/games/red-fortress-jeep-rescue-shooter-hr3l

**预告片**：`tools/video/red-fortress-trailer.mp4`（73s，中文旁白 + 字幕 + 游戏原声）。
YouTube: https://youtu.be/cL70bhb_LwY · 抖音: https://www.douyin.com/video/7705247762933173544 · X: https://x.com/johnsonguo2026/status/2118893375118278787

**本地运行**：`index.html`（ES Module，需要静态服务器）。零依赖、零构建、断网可玩。

## 运行

```bash
cd games/red-fortress
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/?lang=zh
```

## 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 驾驶 | WASD / 方向键 | 左摇杆 |
| 瞄准 | 鼠标 | 右摇杆 |
| 机枪 | 左键 / J | 右摇杆推动自动开火 |
| 手雷 | 右键 / K / 空格 | 手雷按钮 |
| 暂停 | Esc / P | 右上角按钮 |

## 核心机制

- **救人即火力**：战俘会排成一串跟着吉普跑，带到 H 停机坪交付 → +分、+手雷、回装甲。
- **里程碑**：单关交付 4 人 → 机枪射速永久提升；交付 8 人 → 武装直升机掠过，前方 3 波轰炸。
- **手雷改写地形**：抛物线落点爆炸，能炸塌沙袋墙、清掉敌人子弹。
- **两场 Boss**：第 3 关重装坦克，第 4 关要塞核心（4 炮节点 → 破盾 → 核心；进场补给修满装甲）。
- **4 关 × 3 条命**：丛林黎明 / 河谷铁桥 / 沙海据点 / 赤色要塞；关间三选一改装，8 种可叠加。
- 中英双语、移动端横屏、存档记录（最高分 / 最远关卡 / 累计救援）。

## 目录

```
index.html  styles.css
config/        数值、敌人、升级、关卡、配色、中英文案
src/core/      i18n / 存档 / 音频
src/game/      纯逻辑 sim（可 node 测试）
src/render/    Canvas 2D 渲染与特效
src/ui/        DOM 界面与 HUD
src/main.js    固定步长 / 状态机 / 输入 / 事件分发
tests/         node:test 纯逻辑测试
tools/         验收计划、selfplay、renderbench、audio-check
```

## 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node tools/audio-check.mjs
```

## 调试口

```js
window.__ll.state        // { phase, stage, score, hp, pow, … }
window.__ll.startStage(i)
window.__ll.demo.upgrade() / dead() / gameover() / ending() / boss()
window.__ll.run          // 纯逻辑快照
```

## 版权

本作是对 1986 年 Konami《Jackal（赤色要塞）》**品类与核心循环的原创重制**：
所有代码、像素造型、地图、音乐音效均为本项目程序化原创，未使用原作任何素材。
