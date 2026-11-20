# JUNGLE CHESS · 翡翠林棋会

经典斗兽棋（Dou Shou Qi）改造的网页版：指挥 8 兽种跨过翡翠河、设陷阱、跳河、占穴。鼠可吃象、虎狮跳河、陷阱诱敌、占领兽穴即胜。

## 运行

```bash
cd jungle-chess
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态、零运行期依赖（唯一例外站点 SDK，断网自动降级）。

## 操作

- 点选己方棋子 → 点高亮目标格走子（桌面鼠标 / 触屏同）。
- 快捷键：`Esc`/`P` 暂停，`R` 重开，`M` 静音。

## 结构

- `config/`：关卡（12 关：6 谜题 + 6 对局）、文案（en/zh）、SDK、设计源 `design.json`。
- `src/game/`：`rules.js` 纯规则、`ai.js` minimax、`sim.js` 状态机。
- `src/render/`：Canvas 2D 程序化美术（三场景包 + 兽首徽章）。
- `src/core/`：i18n / audio / sdk（统一出口）。

## 门禁

```bash
node --test && node tools/selfplay.mjs && node tools/audio-check.mjs
```

完整流水线见 `docs/DELIVERY.md`。
