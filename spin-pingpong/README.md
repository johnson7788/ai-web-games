# SPIN PINGPONG

霓虹街机「预测光子出口」益智游戏：记住棱镜角度，猜中光子从哪扇门飞出。

- 零构建纯静态：`index.html` + ES Module，`python3 -m http.server` 即可跑。
- 零依赖零外链：美术全 Canvas 程序化，音频纯 WebAudio，SDK 本地 vendored。
- 桌面 + 移动端；en 默认 + zh 完整；`?lang=` 可覆盖。

## 玩法
1. 短暂记住棋盘上发光棱镜的朝向（`/` 或 `\`，光子撞上按 90° 镜面反弹）。
2. 棱镜消失，光子从绿色箭头射出。
3. 点选你认为的琥珀色出口门；猜中连胜积累连击，猜错连击清零。

新机制：三星评级（正确/快速/未窥视）、跨关连击得分、窥视道具（重新显示棱镜，但失去完美星）。

## 目录
- `config/` — 数值 / 关卡 / 文案 / SDK / 设计源
- `src/game/sim.js` — 纯逻辑（可测）
- `src/render/` — Canvas 渲染
- `src/core/` — audio / i18n / sdk
- `src/main.js` — 装配 + `window.__ll` 调试契约
- `tools/` — selfplay / verify plan / audio-check / poster
- `tests/` — node --test 断言

## 门禁
见 `docs/batch3/spin-pingpong.md`。
