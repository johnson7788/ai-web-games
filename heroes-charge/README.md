# HEROES CHARGE

> 霓虹街机横版格斗 · A neon beat-em-up through the synth city.

## 运行

```bash
cd heroes-charge
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 | 触屏 |
| --- | --- | --- |
| 左移 / 右移 | A·D / ← → | 左/右方向键 |
| 攻击（二段连击） | J | ⚔ |
| 冲刺（耗能量） | K | ≫ |
| 跳跃（二段跳） | Space / W | ⤒ |
| 技能（地面光弹 / 二段跳旋转斩） | L | ✦ |
| 暂停 | Esc / P | — |
| 重开 | R（结算时） | — |

## 语言

- 默认 **英文**；标题右上角下拉可切 **中文**。
- `?lang=zh` / `?lang=en` 可临时覆盖；选择写入 localStorage（`heroes-charge-lang`）。
- 所有可见文案走 `config/locales.js` 的 `t()`；**en 与 zh 必须完整**。

## 测试与门禁

```bash
node --test                                              # ≥10 条断言
node tools/selfplay.mjs                                  # greedy/random/noinput → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node tools/shots.mjs                                     # 生成 tests/final/ 截图
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node tools/poster.mjs                                    # poster.jpg
```

## 玩法

- 横版格斗：挥剑、冲刺、二段跳、光弹、旋转斩，连击攒分数。
- 敌人：巡逻 → 追猎 → 攻击；清光每一关所有敌人解放街区（共 3 关，第 3 关有精英 Boss）。
- 新机制（相对原版 LightSword）：**连击系统**（每 5 连击加分 + 音效）、**星级评分**（血量 + 连击决定 1–3 星）、**能量球/护盾核心掉落**（补冲刺 / 挡一次伤害）。

## 调试契约

`window.__ll` 暴露：`state.phase`、`start()`、`pause()`、`resume()`、`restart()`、`run`、`tutorial`、`startTutorial()`。
