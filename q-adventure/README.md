# Q ADVENTURE · 果冻豆骑士救公主

横版平台跳跃网页游戏（纯静态 + Canvas 2D 程序化渲染 + WebAudio 程序化音频）。改造自《Q萌大冒险》客户端源码（行为树敌人 1:1 借鉴），角色/场景/音乐全原创。

## 一句话

果冻豆骑士在糖果丘/云端/夜林三世界横版冒险：跑、二段跳、蹬墙跳、踩敌回弹，踩着鼓点救公主。

## 核心机制

- **果冻弹跳**：二段跳带挤压形变；**踩敌**果冻压扁回弹（signature）。
- **果冻吸附**：贴墙缓慢下滑 + 蹬墙跳（立体路线）。
- **鼓点跳**：BGM 节拍上起跳 +15% 高度（音游化平台）。
- **行为树敌人**：巡逻 → 发现玩家 → 追击（还原原作 `Priority[Look→Chase, Patrol]`）。

## 操作

←/→ 或 A/D 跑 · 空格跳（二段/蹬墙）· R 重开 · Esc 暂停。触屏：◀ ▶ 按钮 + 跳跃按钮。

## 目录

- `config/`：design.json / game.config / gameplay / levels / locales / sdk.config
- `src/game/sim.js`：纯逻辑模拟（可 node 直测）
- `src/render/`：程序化三场景包渲染
- `src/ui/`：屏幕 / HUD / 首次引导
- `src/core/`：i18n / sdk / audio
- `tools/`：selfplay / verify / audio-check / shots / record-gif / poster
- `tests/`：node:test 纯逻辑测试

## 本地跑

```bash
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124
```

## 反范围（不做）

联网/排行榜、皮肤商店、每日任务、Boss 战、竖屏专属模式。

## 门禁

全套自动门禁见 `docs/report.md`（node --test / selfplay / fun-audit / fun-report / verify-game / i18n / tutorial / sdk / audio / vision-review 全部 ≥WARN）。
