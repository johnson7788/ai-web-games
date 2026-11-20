# BRICK SIX · 蜂巢工坊

六边形堆叠消除：随机蜂巢块组落盘，铺满整环即消除，一次消三环触发「蜂王浆」金瀑。

## 运行

```bash
cd games/brick-six
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态，无运行期依赖（仅站点 SDK 可降级 mock）。

## 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 瞄准 / 落位 | 鼠标移动 / 点击 | 点击格子 |
| 旋转 | `R` / ↻ 按钮 | ↻ 按钮 |
| 换块 | `Tab`/`E`/`Q`/`1–4` | — |
| 键盘落位 | 方向键 + `Space` | — |
| 暂停 | `Esc` | 暂停按钮 |

## 机制

- **消除**：3 个方向共 27 条线，铺满一条即消（50 分/格），多线连消翻倍。
- **蜂王浆金瀑**：一次消满 3 环触发 +500 奖励与黄金粒子。
- **蜂窝封蜡**：每 10 块随机一格封蜡，需消两次。
- **花粉块**：落地 3 步内被消则传染清除邻格。
- **12 档推进**：目标分递增 + 特性轮换（窄盘/双生成口/蜡密度/花粉富集/大块占比）。
- **三场景包**：春巢（金绿）/ 蜜库（琥珀）/ 冬巢（蓝白）。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

全部 ≥WARN 才算完成；详见 `docs/report.md`。
