# FRONT WARS · 前线战争

4v4 俯视角竞技场射击。蓝方（你 + 3 名 bot 队友）对红方 4 名 bot，三回合两胜；每回合先达 **15 击杀**，时间到平分进入加时。

**已上线：** https://pipygames.com/games/front-wars-4v4-bot-arena-shooter-nljr  
**线上直链：** https://pipygames.com/g/g_1794651969571_rnnljr/index.html

- 品类：射击 / 街机（团队 / 俯视角 / 单机 bot）
- 技术：零构建纯静态 · ES Module · Canvas 战场 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长
- 规模：3 回合 · 3 兵种 · 8 个回合强化 · 冲刺 · 中央过载核心 · 首次 4 步交互引导

## 运行

```bash
cd games/front-wars
python3 -m http.server 8124
# http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 桌面：`WASD` / 方向键移动，鼠标瞄准，按住左键开火，`Shift` / `Space` 冲刺，`Esc` / `P` 暂停。
- 手机横屏：左摇杆移动，右摇杆瞄准并自动开火，`DASH` 按钮冲刺。
- 竖屏会显示旋转提示。

## 规则

- **3 回合两胜**；每回合先达 15 击杀，或 120 秒结束时击杀多者胜；平分进入加时，下一杀结束。
- **3 兵种**：
  - 步枪兵：100 HP / 速度 210 / 25 伤害，均衡。
  - 侦察兵：80 HP / 速度 255 / 17 伤害 / 高射速，脆但快。
  - 重装兵：145 HP / 速度 170 / 42 伤害，慢但硬。
- **冲刺**：2.6 秒冷却，0.16 秒突进；冲刺时不射击。
- **过载核心**：每 18 秒在中央上线，拾取后 8 秒射速翻倍、伤害 +5。
- **8 个回合强化**：急速射击 / 防弹插板 / 轻量战靴 / 穿甲弹 / 战地医疗 / 小队指挥 / 快速归队 / 过载核心。
- 阵亡 2 秒后在本方出生区满血重生；击杀/死亡/回合比分实时显示。

## 上线状态

- 已发布到 Pipygames，详情页与直链均可打开。
- 线上验证：`desktop` 进入 `playing`、`hud=true`；`iphone` 竖屏 `rotate=flex`、横屏 `rotate=none`；0 游戏 console/page error。
- 线上交互：首次 Start 出现 4 步引导；跳过进入兵种选择；选 Scout 开局后移动、瞄准、开火均正常；刷新后不再自动弹引导。
- 证据：[online-verify.json](tests/final/online-verify.json) · [online-tutorial.json](tests/final/online-tutorial.json) · [online-playing.png](tests/final/online-playing.png)。

## 首次交互引导

第一次点 Deploy 进入 4 步引导，不是说明书：

1. 走进发光圆环（移动）；
2. 把枪口对准训练靶（瞄准）；
3. 按住开火打掉训练靶（射击）；
4. 按 Shift / 点 DASH 冲刺（位移）。

可跳过、可重看；跳过/完成后刷新不再自动弹（站点 sandbox 下 localStorage 不可用，用 URL hash 兜底；新开页面视为新玩家，可跳过）。证据：`tests/final/tutorial-report.json`。

## 测试与验收

```bash
cd games/front-wars
node --test                                                   # 13 条纯逻辑测试
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/artifacts
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/final
node ../../skills/webgame-playbook/scripts/asset-check.mjs --root .

# Auto Gate
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

本轮实测：

- `node --test`：13/13 通过。
- `verify-game`：PASS，60fps，0 console/page error。
- `i18n-check`：en/zh 各 66 key，0 缺失。
- `sdk-check`：SDK 就绪 / 广告关闭 / 埋点 / 存档 / 分享 / 域名拦截降级通过。
- `fun-audit`：PASS 100/100（26 项）。
- `fun-report`：PASS 10/10。
- `tutorial-check`：PASS（4 步、可跳过、刷新不重复、可重看）。
- `vision-review`：PASS，均分 readable 8.7 / silhouette 7.0 / style 8.3。

## 目录

```
config/      game.config（战场/兵种/强化/规则）/ tutorial / locales / design.json / sdk.config
src/game/    sim.js（纯逻辑：移动/弹道/伤害/击杀/重生/兵种/冲刺/过载/回合/强化/教学）
src/render/  index.js（战场/掩体/士兵/弹道/命中/训练靶/过载点）
src/ui/      ui.js（HUD/兵种/回合强化/结算/首次引导/触屏）
src/core/    i18n / save / sdk
tests/       sim.test.mjs + final/（验收截图/引导证据）
tools/       autoplay.mjs / verify.plan.json / fun/
```

## 调试契约 `window.__ll`

```js
__ll.state.phase        // title / loadout / playing / paused / round / over
__ll.start()            // 直接开一局（跳过引导/兵种，自动化用）
__ll.startTutorial()    // 教学局
__ll.startMatch(id)     // rifleman / scout / heavy
__ll.debug.state()      // HUD：scores/round/roundWins/timeLeft/hp/kills/deaths...
__ll.debug.step(sec,input)
__ll.debug.winRound(team)
__ll.debug.nextRound(perkId)
__ll.telemetry(policy)
```
