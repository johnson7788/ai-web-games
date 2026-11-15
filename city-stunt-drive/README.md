# CITY STUNT DRIVE（城市特技车）

立体车库天台起飞 → 空中转体 → 落地连跳，金币解锁新车。低多边形黄昏城市特技场。

## 运行

```bash
cd city-stunt-drive
python3 -m http.server 8124        # 或任意静态服务器
# 打开 http://127.0.0.1:8124/
```

零构建纯静态（index.html + ESM），零运行期外链（唯一例外 pipysdk，失败降级可玩）。

## G0 · 八问

1. **一句话**：玩家在天台特技场加速冲坡道，空中按 ←/→ 做桶滚转体，落地角度够稳就完美落地、连击叠加，一路收金币解锁三辆新车。
2. **参考**：GTA 特技车 / cconsta1/threejs_car_demo（MIT 物理调参参考）的空中转体 + 坡道飞车品类；本地参考 games/drift-limits 的车辆手感与 __ll 结构。
3. **差异化**：① 连击式「完美落地」判定（角度 + 速度方向，不是单纯距离）；② 空中桶滚绕前进轴计圈（不是像素跳跃）；③ 黄昏霓虹天台的低多边形美术。
4. **操作**：键鼠 W/S 油门刹车、A/D 转向、空中 ←/→ 桶滚、Q/E 偏航、空格氮气、R 重开；触屏左下油门/刹车踏板、右侧转向、翻转与氮气按钮。
5. **一局**：跑完 5 组坡道冲线结算，约 60–90 秒；摔翻车 3 秒自动吊回坡道前，扣连击不扣局。
6. **成长**：局内连击倍率 + 氮气充能；跨局金币解锁 3 辆车（基础/肌肉/超跑，手感不同）+ best/最佳连击/最远翻转记录。
7. **结局**：冲线看评级 S/A/B/C + 统计 + 一键重开；摔翻车只看扣连击，不结束。
8. **乐趣**：主乐趣 mastery（落地窗口越来越窄的掌控感），副乐趣 expression（转几圈的炫技）。第 3 分钟还在玩是因为「差一点就 3 连」；第一个有代价的决定在第 8 秒（冲大坡还是走小坡保连击）。

- **乐趣假设**：转体圈数越贪落地越难，形成「贪分 vs 保连击」的可重复取舍；用 fun-audit（结构）+ bot 遥测（首胜 ≤60s、事件密度、至少一条 run 死过）验证。
- **签名记忆点**：空中三连转后完美落地，屏幕弹出 **PERFECT ×3** 金色冲击波。
- **反范围**：不做联机 / 开放世界 / 车辆改装树（只 3 辆解锁车）/ 剧情 / 赛道编辑器。
- **美术来源**：AI 出图（sky.jpg / road.webp / ramp.webp / 海报 / 图标），程序化渲染兜底 + 低多边形几何车/建筑。

## 数据契约

- **世界**：直线天桥沿 +z，跑道半宽 11、冲线 z=620；逻辑帧 60Hz 固定步长；单位 ≈ 米。
- **地面**：`track.groundY(z)` 分段函数——坡道区间线性抬升、坡顶回落 0（形成起飞）；`slopeAt(z)` 给切线。
- **实体字段**：`player = { x,y,z, vx,vy,vz, roll,pitch,yaw, grounded, airborne, airRoll, airYaw, overturnT }`。
- **输入契约**：`{ throttle:-1|0|1, steer:-1..1, flip:-1..1, yaw:-1..1, nitro:bool }`；边沿检测在 main.js。
- **事件**（sim 发 → main 分发 → render/audio/ui 消费）：`launch`、`flip`、`perfect`、`badLand`、`coin`、`nitro`、`zone`、`dist`、`wreck`、`finish`。
- **模块 API**：`createSim(opts)` / `updateSim(run, input)` / `getHud(run)` / `drainEvents(run)` / `ratingFor(score)`；`Render.render(run,dt)/onEvent/resize`；`UI.showTitle/showGame/showPause/hidePause/showResults/updateHUD/popup`；`Audio.unlock/setMuted/muted/play(name)`。
- **状态机**：`title → playing → (paused ⇄) → results → title`；sim 内部 `run → finished`。

5 行 smoke：

```js
const r = createSim({ car: 0 }); updateSim(r, { throttle: 1 }); r.hud = getHud(r); drainEvents(r); getHud(r);
```

## 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 油门 / 刹车 | W/↑ / S/↓ | 左下踏板 |
| 转向 | A / D | 右侧转向按钮 |
| 空中桶滚（翻转） | ← / → | 翻转按钮 |
| 空中偏航 | Q / E | — |
| 氮气 | 空格 | 氮气按钮 |
| 重开 / 暂停 | R / Esc | — |

## 语言 / 存档 / SDK

- 默认英文，中文必做（`config/locales.js` 整块完整才暴露）；下拉 + `?lang=` + localStorage 保留。
- 存档只经 `src/core/sdk.js`（域名锁/广告/埋点/存档/分享统一出口），SDK 缺失落 localStorage。
- SDK 配置源 `config/sdk.config.js`（`source:'local'` vendored；广告 `enabled:false`）。

## 测试 / 验收

```bash
/opt/homebrew/bin/node --test                                              # 21 条纯逻辑
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .      # 设计结构
/opt/homebrew/bin/node tools/selfplay.mjs                                  # bot 遥测 → autoplay.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .     # Fun Gate
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

## 已知 TODO

- 运行时长偏短（bot 约 24s 通 5 坡）——如需贴 brief 的 90–150s，调低 `CARS[].maxSpeed` 或加长平路间距（数值在 config，±20% 内可调）。
- 金币路线目前偏直线贪吃，未做「绕远拿币 vs 直冲」的强分歧路线（设计里 `atSec:45` 的决定是软性的）。
- 氮气只有一罐、无跨区补给策略层（当前靠金币/完美落地充能）。

## 调试契约

`window.__ll`：`state.phase`（title/playing/paused/results）、`start/pause/resume/restart/startAct`、`run`、`hud`、`tutorial`（active/step/steps/current/skip）、`setInput`（bot 注入）、`setLang`。
