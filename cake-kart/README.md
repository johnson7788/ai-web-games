# CAKE KART

> 蛋糕飞车 — 甜品卡丁车圈速竞速（伪 3D Mode7）

## 运行

```bash
cd games/cake-kart
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键盘 | 触屏 |
| --- | --- | --- |
| 转向 | ← →（或 A / D） | 左右按钮 |
| 油门 | ↑（或 W） | ▲ 按钮 |
| 漂移 | 转向时按住 Shift | DRIFT 按钮 |
| 使用道具 | 空格 | ITEM 按钮 |
| 暂停 | Esc | — |
| 再来一局 | R（完赛后） | 结算按钮 |

## 玩法

- **圈速竞速**：12 站翻糖大奖赛，每站 3 圈（前 3 站 2 圈），AI 车手逐站提速。
- **糖霜漂移**：转向时按住 Shift 蓄力三档——越满越难控，松手喷出奶油拖尾加速。
- **甜点武器**：樱桃导弹 / 威化护盾 / 果冻加速 / 蛋糕炸弹（糊对手屏幕 2s）。
- **地形**：果冻加速带、巧克力泥减速区、窄桥。

## 语言

默认英文；标题右上角 / 暂停 / 设置可切中文；`?lang=zh` 覆盖；选择持久化。

## 测试 / 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
```

详见 `docs/report.md` 与 `docs/analysis.md`。
