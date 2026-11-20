# STAR SLAYER

驾驶机甲「铁卫」与 AI 伙伴「光核」并肩作战的顶视角波次射击游戏。玩法规则 1:1 还原自开源参考「超能陆战队-creator」，角色/场景/IP 全原创。

## 运行

```bash
cd star-slayer
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态、零运行期依赖（唯一例外：站点 pipysdk，断网降级可玩）。

## 操作

| 动作 | 键鼠 | 触屏 |
| --- | --- | --- |
| 移动 | WASD / 方向键 | 左下虚拟摇杆 |
| 攻击（自动瞄准） | J / 空格（按住） | FIRE |
| 相位同步（换位） | L | SYNC |
| 超载协议（清屏大招） | K | OVER |
| 暂停 | Esc / P | — |
| 重开 | R | — |

## 核心机制

- **协同复制提前量**：你的每次射击，光核 0.5s 后延迟复制一发——打提前量是技巧。
- **相位同步**：L 与光核换位 + 冲击波 + 短暂无敌（4s 冷却）。
- **超载协议**：血量 <30% 且光核在线时按 K，自爆光核清屏，光核离线 20s。
- **12 波**：三场景包（舰桥蓝白 / 舰体外壳灰橙 / 反应堆青紫），每 3 波 Boss，波间三选一技能卡（规则型 ≥35%）。

## 语言

默认 **英文**，标题屏/设置下拉可切 **中文**；`?lang=zh` 可临时覆盖；选择持久化。文案全部走 `config/locales.js`。

## 验收

```bash
node --test                                                          # ≥15 条纯逻辑测试
node tools/selfplay.mjs                                              # 3 策略 bot 遥测
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .   # Fun Gate
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .    # 设计审计
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

全部门禁绿色；详细记录见 `docs/report.md`。

## 目录

```
index.html / styles.css   入口与样式
config/                   数值 / 关卡 / 卡牌 / 文案 / SDK（design.json = 设计源）
src/game/                 纯逻辑模拟（sim / rng）
src/render/               程序化 Canvas 渲染
src/ui/                   屏幕 / HUD / 首次引导
src/core/                 i18n / sdk / save / audio
tests/                    node:test 纯逻辑测试
tools/                    自玩 / 验收 / 截图 / 录 gif / 海报
docs/                     分析 / 报告 / SEO
game.gif / poster.jpg     列表页物料
```
