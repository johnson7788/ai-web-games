# GRUMPY BIRDS SIEGE

> 愤怒小鸟攻城记 · 霓虹街机 · Flappy 换皮 + 3 新机制

一只发怒的小鸟单枪匹马攻城：点击振翅穿过城墙缺口，躲开投石车的飞石、捡护盾，冲过 10 道墙破城。桌面 + 移动端。

## 运行

```bash
cd grumpy-birds-siege
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零依赖零外链：纯静态 `index.html` + ES Module，美术全程序化 canvas，音频纯 WebAudio。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 振翅 | Space / ↑ / 点击 |
| 俯冲 | 按住（Space / 触摸） |
| 暂停 / 恢复 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法规则（P0，1:1 复刻参考源码）

- 点击振翅（上冲速度重置），重力逐帧减速（`src/game/sim.js`）。
- 3 道攻城墙滚动逼近，缺口随机且上下浮动；撞墙/地面/飞石/哨兵即死。
- 通过缺口计数，过 10 道墙破城胜利。
- 100 关，滚动速度随关卡提升（`scrollSpeed = 3.0 + (level-1)*0.03`）。

## 换皮新机制（3 个）

1. **投石车飞石**（L3+）：轻重力抛物线飞石横向掠过，需躲避。
2. **护盾道具**（L4+）：霓虹六边形，拾取后挡一次飞石/哨兵，但破盾清空连击。
3. **连击 + 星级**：连续过墙累积连击加成，结算按最高连击给 1–3 星（满连击 = 3 星）。

## 语言

- 默认 **英文**，`zh` 完整；`?lang=zh` 可覆盖，写入 localStorage 保留。
- 自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`。

## 全部门禁

```bash
cd grumpy-birds-siege
node --test                        # 16 tests
node tools/selfplay.mjs            # greedy/random/noinput → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/tutorial
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html          入口
styles.css          霓虹样式
config/             配置与文案（design.json / game.config.js / locales.js / sdk.config.js）
src/core/           i18n / audio / sdk
src/game/sim.js     纯逻辑（可测，可无头自对弈）
src/render/         canvas 程序化渲染
src/ui/             DOM UI
src/main.js         主入口 + window.__ll 调试契约
src/vendor/         pipysdk（本地 vendored）
tests/              单测 + 截图产物
tools/              selfplay / audio-check / verify.plan / fun
```

## 调试契约

`window.__ll` 暴露：`state.phase`（title/playing/paused/result）、`start/pause/resume/restart/home`、
`run/sim`、`save/load`、`tutorial{active,step,steps,current,skip}`、`startTutorial`、`debug{...}`。
