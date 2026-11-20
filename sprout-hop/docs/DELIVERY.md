# Sprout Hop · 交付报告（豆荚跳跳）

改造自 `local/src1/瓜瓜跳cocos/`（Cocos 青蛙拖拽抛物线跳），sl=slug=`sprout-hop`，title=`SPROUT HOP`，appId=`pipy-sprout-hop`。

---

## 1) 源码分析摘要（原作玩法事实）

原作为 Cocos Creator 青蛙跳荷叶游戏，核心是「拖拽蓄力 → 抛物线跳 → 落台得分 → 落水判负」。关键事实（带文件:行号）：

- **拖拽蓄力** `assets/scripts/PlayerCtrl.ts`：
  - `touchStart` (L103-110)：记录 `drawStartPos`，显示方向箭头。
  - `touchMove` (L112-126)：`drawVec = drawStartPos - endPos`（**反向拖拽 = 弹射方向**），`angle = atan2(drawVec.y, drawVec.x)`，`speed = drawVec * 4`。
  - `touchEnd` (L128-149)：`angle < -90 || angle > 90` 取消发射；`speed` 按轴钳制到 800；发 `canMove` 事件。
  - `drawLine` (L151-174)：用 Graphics 画抛物线轨迹点，**但函数首行 `return;` 使轨迹预览被实际禁用**（spec 要求还原为 P0）。
  - `setCtrlInfo` (L180-186)：力度条 `progress = length/200`（封顶 1）。
- **抛物线物理** `assets/scripts/FrogManager.ts`：
  - 重力 `gravity = 500`（L18）；`update` (L53-65) 逐帧 `x += speed.x*dt; y += speed.y*dt; speed.y -= gravity*dt`。
  - 碰撞 `onCollisionEnter` (L67-101)：`tag 1`=金币 +1；`tag 2`=平台 → `distance = node.x - lastPos.x`，`distance <= 0` 直接 return（不前进不结算），否则发 `bgMove(distance)` + `touchStage`（+2 分）；`tag 3`=墙 → 失败特效。
- **世界滚动** `assets/scripts/GameBg.ts`：
  - `init` (L195-247)：初始平台横向间距 `minX=300, maxX=400+floor(stageCount/3)*50`（封顶 700），纵向 `-280 ~ -175+floor(stageCount/10)*30`（封顶 150），两平台间生成金币；无限随机延伸。
  - `move` (L146-193)：落台后整世界按 `distance` 左移，青蛙回到锚点（等价本作 camX 滚动）。
- **UI/结算** `assets/scripts/UIManager.ts`：分数/金币 label、结算面板、道具「帮助/复活」（每局复活 ≤3 次，走视频/分享）。
- **明确不还原**：排行榜/微信（`RankLayer.ts`、`WXManager.ts`、`HttpManager.ts`），spec 已注明。

## 2) 改造点清单

**保留（玩法规则 1:1）**
- 拖拽蓄力 → 抛物线跳 → 落台得分 → 落水/出界判负的核心循环。
- 反向拖拽 = 弹射方向；重力 500；单轴速度上限；**轨迹弧线预览**（原作被 `return;` 注释，本作完整实现为虚线弧线 + 落点圈 + 金旗目标标记）。
- 世界水平滚动（落台前进距离后平台回到锚点，等价原作的 `bgMove`）。
- 「落台即 +2 分」的得分手感（本作扩展为中心完美加分）。

**原创主题与改造**
- 角色：青蛙 → **圆滚滚豌豆射手**（头顶豆芽、腮红）；平台：荷叶 → **豆荚/南瓜/竹筐/断藤**；判负：撞墙 → **落水/出界**。
- 三场景包（换章必换色板/构图/装饰）：晨露菜园 / 午后藤棚 / 月下豆田。
- 12 关推进结构替代原作无限随机：固定藤架 → 渐距 → 弹性南瓜（回弹 1.3×）→ 移动藤筐 → 顺风段 → 断藤（0.6s 塌）→ 高低双层路线 → 风向反转（逆风）→ 竹筐吸力 → 双层+顺风 → 断藤+南瓜 → 终章大藤架。
- **中心完美判定**（原作 `touchStage` 固定 +2，无中心判定）：本作原创「完美落点」额外加分 + 连击，擦边「惊险」额外加分。
- 复活：原作视频/分享复活 → 统一走 SDK 激励广告位（`config/sdk.config.js` `ads.enabled:false`，降级安全返回 false）。
- 素材全程序化 Canvas（角色/平台/场景/BGM/SFX 均无外部素材、零运行期外链）。

## 3) 门禁最终输出摘要

全部在 `games/sprout-hop/` 内执行，`node` 用直连二进制 `/opt/homebrew/bin/node`（本机 `node` 是坏掉的 nvm-lazy 别名）。

| 门禁 | 结果 |
| --- | --- |
| `node --test` | 24 pass / 0 fail |
| `node tools/selfplay.mjs` | greedy 串行到第 3 关（levels=3, completed=true）；random×2 各死亡 1 次；noinput 基线 12s |
| `fun-report.mjs --root .` | **PASS**（10 pass / 0 warn / 0 fail；首胜 2s、行动 218/min、空转 0%、事件 10 种、推进率 100%、死亡存在率 50%） |
| `fun-audit.mjs --root .` | **PASS**（100/100，26 pass / 0 warn / 0 fail） |
| `verify-game.mjs --root . --plan tools/verify.plan.json` | **pass:true**（60fps，0 console/page error，0 失败请求，0 外部请求） |
| `i18n-check.mjs --root .` | ✓ i18n OK（en/zh 各 42 key，0 缺失 0 空） |
| `tutorial-check.mjs --root .` | ✓ tutorial PASS（3 步 aim/launch/land，可跳过/持久化/可重看） |
| `sdk-check.mjs --root .` | pass:true（SDK 对象/API/降级/存档/分享/0 error 全绿） |
| `node tools/audio-check.mjs` | PASS（BGM 33.1s 无缝循环 + 12 SFX 全过 RMS/时长/峰值） |
| `vision-review.mjs --root .` | **PASS**（readable 8.1 / silhouette 8.8 / style 9.8，goal_visible 全 Y，0 HUD 遮挡，0 文字裁切） |

证据目录：`tools/fun/{autoplay,design-audit,report,fun-report,audio-report}.json`、`tests/final/{vision-review.json,vision-review.md,tutorial-report.json,01..08-*.png}`、`tests/artifacts/{verify-report.json,sdk-report.json}`。

## 4) 物料路径

- `poster.jpg`（1280×720）、`poster-1920.jpg`（1920×1080）——真实玩法画面（蓄力轨迹弧线）+ 大标题贴纸字
- `game.gif`（480×270，4.24s 循环，0.40MB）——前 3 秒即「拖拽蓄力 → 松手弹射 → 落台爆裂」
- `SEO.txt`——TITLE / CATEGORY / TAGS / SHORT DESCRIPTION / LONG DESCRIPTION 五个大写关键词，中英双份
- `icon.png`（256×256）、`favicon.png`（48×48）——豌豆射手角色

生成脚本：`tools/shots.mjs`、`tools/record-gif.mjs`、`tools/poster.mjs`、`tools/icon.mjs`。

## 5) 未做项与已知问题

- 排行榜、微信分享、金币购买道具：spec 明确不还原（原作 `RankLayer/WXManager/HttpManager`）。
- 广告账号未接入：`config/sdk.config.js` `ads.enabled:false`（按 spec 保持，`showRewarded` 安全降级返回 false）。
- 移动竹筐的轨迹预览画在**基座中心**，未预判摆动相位（摆动幅度 36px，落点偏移有限但预览不完全精确）。
- 无真人试玩数据（全自动流水线默认 bot 遥测，真人数据仅可选加分证据）。
- `assets/` 目录为空：本作全程序化素材，无 AI 贴图，故未跑 `asset-check`（无 `assets/` 目录）。

## 6) 最不满意的一处

移动竹筐的轨迹预览没有把平台的实时摆动并入落点预测——预览点落在基座中心，实际落点会随摆动在 ±36px 内偏移。这是「轨迹预览核心手感」里最薄的一环；理想解法是在 `predictTrajectory` 里按预测飞行时长外推 `platformScreenX(plat, camX, clock + t)`，但会显著增加预览计算的复杂度，本版先用「窄摆动 + 宽落点带」把误差压到可控范围。
