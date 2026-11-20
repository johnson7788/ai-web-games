# NEON PINBALL · 霓虹弹珠

> 复刻原型：Cocos Creator《king of pinball》。1:1 保留「弹珠物理 + 推杆发射 + 命中计分 + 多球 + 掉落判负 + 逐台推进」核心循环；全面原创改造为霓虹赛博弹球台：超导态、充能挡板、黑洞孔、12 台机关轮换、三场景包。

## 运行

```bash
cd games/neon-pinball
python3 -m http.server 8124   # 或任意静态服务器
```

## 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 发射 | 按住 Space 蓄力，松开发射 | —（自动发射） |
| 左挡板 | ← / Z | 左半屏点按 |
| 右挡板 | → / M | 右半屏点按 |
| 轻推 | N | — |
| 暂停 | Esc / P | — |
| 重开 | R（结算页） | 结算按钮 |

## 玩法一句话

蓄力把霓虹球打上台面，左右挡板救球，命中电容球 bumper 与目标灯刷分；集齐 3 个超导灯触发 20 秒超导态（台面蓝白、bumper ×3、球带电拖尾），充能挡板满力打顶环，黑洞孔周期开合吸入 5 秒后随机射回。

## 工程结构

- `config/` gameplay（物理/计分数值）/ tables（12 台）/ locales(en,zh) / sdk.config / design.json（fun-audit 100 分）
- `src/game/` 纯逻辑 sim + physics + table + rng（28 个 node:test，同 seed 确定性）
- `src/render/` Canvas2D 发光渲染（3 场景包：电玩厅粉紫/主机房青蓝/霓虹雨街橙红）
- `src/ui/` 标题/HUD/暂停/结算/4 步交互引导（tutorial-check PASS）
- `src/core/` audio（WebAudio 合成 20 音效 + 程序化 BGM）/ sdk（pipysdk 统一出口，降级可玩）/ i18n / save
- `tools/` selfplay（3 策略 bot 遥测）/ audio-check / verify.plan / record-gif / poster

## 验收记录（全绿）

`node --test` 28 pass · fun-report PASS · fun-audit 100 分 · vision-review PASS（readable 8.6）· tutorial-check / i18n / sdk / audio-check 全过 · verify-game PASS（桌面+移动）。证据在 `tests/final/`。
