# CELL WARS

> 培养皿显微镜视角的领土策略对战：蓝菌 vs 红菌，点击相邻格感染扩散。

## 运行

```bash
cd games/cell-wars
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态、零运行期依赖（唯一例外站点 SDK，可降级）。

## 操作

| 动作 | 操作 |
| --- | --- |
| 感染 | 点击蓝菌旁的敌格 / 中立格 |
| 营养滴 | 点击己方蓝格（每回合 1 次，该格及四邻下回合感染力 +2） |
| 噬菌体 | 点 HUD 噬菌体按钮进入选择，再点一格清空 2×2 敌格（3 回合充能） |
| 暂停 | Esc / P |
| 重开 | R（结算时） |

触屏同点击操作。

## 规则

- 感染力 = 目标格四邻己方格数（+ 营养光环）。超过目标防御（cost = def+1）即占领，剩余感染力沿相邻菌落 BFS 连锁蔓延（光丝蔓延签名）。
- 失败感染会削弱目标防御 1 点（防御 1–4）。
- 胜利：清空全部红格；或回合上限到时领土更多。失败：己方被清空。

## 测试 / 验收

```bash
node --test                                            # 28 条纯逻辑测试
node tools/selfplay.mjs                                # 3 策略遥测
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

详见 `docs/report.md`。

## 语言

默认英文，右上角可切中文；`?lang=zh` 可临时覆盖，选择持久化。

## 调试契约

`window.__ll`：`state.phase` / `lang()` / `setLang()` / `run` / `start()` / `pause()` / `resume()` / `restart()` / `tutorial` / `save()` / `ui()` / `debug.layout()`。
