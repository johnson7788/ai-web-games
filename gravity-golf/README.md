# GRAVITY GOLF

侧视弹道高尔夫：拖拽定角度、按住蓄力、松手击球。球在六颗重力不同的星球上飞出、
弹跳、滚动、停下；距离换金币，金币升级球杆，最远距离进存档。只有一个玩法：
**无限距离挑战**。

`One swing to the moon.`

## 操作

| 输入 | 行为 |
| --- | --- |
| 从球位按下并拖拽 | 弹弓式瞄准：反向拖拽 = 出球方向，拖拽距离 = 力度（0..1） |
| 松手 | 击球 |
| 按住 `Space` | 蓄力条往复，松开击球 |
| `↑` / `↓`（或 `W`/`S`） | 调整出球角度（-10°..80°） |
| `U` | 打开/关闭升级面板（每 3 杆也会自动弹出） |
| `Esc` / `P` | 暂停 / 继续（`window.blur` 自动暂停） |

## 规则

- 距离 = 停球位移 ÷ 10px，金币 = `floor(dist^0.9)` + 滞空奖励，幸运升级加成。
- 每打满 3 杆切换下一颗星球（Moon → Mars → Ice → Lava → Gas → Ring 循环），
  每颗星球一套 `{重力, 空气阻力, 弹性, 风, 调色板}`。
- 球速 > 1500px/s：拖尾起火，本杆金币 −10%；> 1750px/s：直接烧毁，金币减半。
  满级 Power 后「全力打月球」会自燃——更远 vs 更稳的取舍。
- 升级 4 条：Power（+出手速度）、Bounce（+反弹）、Luck（+金币）、Spin（+滚动）。
- 烧毁球手没事：击球瞬间球手被后坐力甩飞，ragdoll 翻滚着追球，停球后才落回球位。

## 技术要点

- 零依赖：ES Module + 原生 Canvas 2D；1280×720 逻辑世界 letterbox 等比缩放。
- 60Hz 固定步长（累加器，渲染可冻结插值）；纯逻辑 `src/game/sim.js` 不碰 DOM，
  随机只来自 seed 哈希地形，同 seed 同轨迹。
- 手感：输入到出球 ≤ 2 帧；大冲击落地有 30–80ms 顿帧 + 震屏 + 音效三件套；
  `prefers-reduced-motion` 时关闭震屏。
- 音频为 WebAudio 程序化合成（首次交互解锁），静音状态持久化。
- 文案 en/zh 双语，切换即时生效；调色板切换 0.4s 交叉淡化。

## 目录

```
config/game.config.js   全部数值/星球/升级/调色板
config/locales.js       en/zh 文案
src/game/sim.js         纯逻辑：弹道/反弹/滚动/烧蚀/金币/升级（可 node --test）
src/render/index.js     三层视差渲染 + 球手 ragdoll + 震屏
src/ui/ui.js|audio.js   DOM 界面 / 程序化音效
src/main.js             60Hz 主循环 + 输入 + SDK 接线 + __ll 调试契约
tests/sim.test.mjs      13 个纯逻辑测试
tools/verify.plan.json  浏览器验收脚本（en/zh + 专属断言）
```

## 调试契约

```js
__ll.debug.shoot(power, angleDeg) // 同步打一杆，返回 {ok, distance, coins, burned}
__ll.debug.setPlanet(i)           // 立即切星球（0..5）
__ll.debug.addCoins(n)            // 加金币
```

## 验收

```bash
cd games/gravity-golf
node --test
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/desktop.png
node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/mobile.png --w 844 --h 390 --mobile
```
