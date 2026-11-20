# GEM CASCADE

> 宝石矿脉 · 矿脉宝石爆裂消除（改造自 PopStar/消灭星星）

## 运行

```bash
cd games/gem-cascade
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态、零运行期依赖（唯一例外站点 SDK，可降级）。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 爆破矿簇（≥2 同色连通） | 点击 / 触摸 |
| 矿镐（满 5 蓄力后点单块劈碎） | 点「Pickaxe」按钮后点单块 |
| 淘洗（每关 1 次重排） | 点「Wash」按钮 |
| 暂停 / 继续 | Esc / P |
| 重开 | R |

## 玩法要点

- 10×10 棋盘 5 色，点选 ≥2 连通同色消除，得分 = n²×5。
- 消除后上方宝石下落、空列左移；6 连消触发「矿脉塌方」连锁流光。
- 每关目标分；结尾 0 剩块满额奖励，剩块越多奖励越少。
- 12 关特性轮换：6 色 / 边界岩块 / 双倍矿脉 / 沉底宝石 / 限定步数 / 蓄力加速 / 冰封宝石 / 岩柱 / 组合关。
- 三场景包：萤石洞（紫）/ 铜矿坑（橙）/ 极光冰洞（青）。

## 语言

默认 **英文**；标题右上角可切 **中文**。`?lang=zh` 可临时覆盖；选择写入 localStorage 刷新保留。

## 测试与门禁

```bash
/opt/homebrew/bin/node --test                                          # 22 条纯逻辑测试
/opt/homebrew/bin/node tools/selfplay.mjs                              # 3 策略遥测
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
/opt/homebrew/bin/node tools/audio-check.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

（本机 shell 的 `node` 是坏的 nvm-lazy 函数，需用 `/opt/homebrew/bin/node`。）

## 调试契约

`window.__ll` 暴露 `state.phase / lang / setLang / start / pause / resume / restart / save / ui / tutorial / debug.layout()`，以及 `debug.popLargest / startSeeded / setTutorialDone`（营销物料与验收用）。

## 物料

- `poster.jpg` 1280×720 海报
- `game.gif` 480×270 / 4.5s 玩法录制
- `docs/short.txt` + `docs/long.md` SEO 文案
