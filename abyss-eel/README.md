# ABYSS EEL · 深渊光鳗

> 复刻原型：Cocos Creator《贪吃蛇大战方块》。原汁原味保留「横移长链 + 上滚数字墙 + 吃球增长 + 破块扣球」核心循环；全面改造为深海发光鳗主题：光即视野、冲刺燃烧、连击系统、5 深度带、热泉 Boss、AI 生成深海 BGM。设计源与契约见 `docs/abyss-eel/README.md`。

## 运行

```bash
cd games/abyss-eel
python3 -m http.server 8124   # 或任意静态服务器
```

## 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 转向 | 鼠标移动 / A D / ← → | 拖动 |
| 冲刺 | 按住 Space / Shift | 按住冲刺按钮 / 第二指 |
| 暂停 | Esc / P | — |
| 一键重潜 | R（结算页） | 结算按钮 |

## 玩法一句话

光珠 = 血量 = 弹药 = 视野。撞碎数字珊瑚墙扣珠回火花，2.5s 连破涨连击（×3 封顶），冲刺燃烧光珠双倍破墙；五个深度带各出新机制，2100m 起每 900m 一面再生 Boss 巨墙。

## 工程结构

- `config/` gameplay / levels / locales(en,zh) / sdk.config / design.json（G0 设计审计 100 分）
- `src/game/` 纯逻辑 sim + spawner + rng（47 个 node:test，同 seed 确定性）
- `src/render/` Canvas2D 发光渲染（鳗/墙/粒子/光半径暗角/5 带场景过渡）
- `src/ui/` 标题/HUD/暂停/结算/Boss 血条/4 步交互引导（tutorial-check PASS）
- `src/core/` audio（WebAudio 合成 18 音效）/ sdk（pipysdk 统一出口，降级可玩）/ i18n / save
- `assets/audio/` AI 生成 BGM ×2（主潜 / Boss）
- `tools/` selfplay（3 策略 bot 遥测）/ audio-check / verify.plan

## 验收记录（G5 全绿）

`node --test` 47 pass · fun-report PASS · vision-review PASS · tutorial-check PASS · i18n/asset/sdk/audio-check 全过 · verify-game PASS（桌面+移动）。证据在 `tests/final/`。
