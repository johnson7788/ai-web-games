# ROCKET DERBY · 美术/音频接线交付

## 1) 改了哪些文件

| 文件 | 改动 |
| --- | --- |
| `src/render/arena.js` | ① 天空加载失败回退由纯色改为程序化渐变（CanvasTexture 竖直渐变 `#0a0820→#1e1b3a→#2a2350`）；② 围栏接入 `assets/tex/wall.webp`，按各墙几何长度设 `repeat = len/WALL_H`（RepeatWrapping，贴图缺失回退纯色）；③ 删除未使用的 `tex()` 辅助与 `maxAniso`。 |
| `src/core/audio.js` | 新增 SFX 子轨 gain（`this.sfx`），所有程序化 SFX 语音改走 `sfx → master → DynamicsCompressor → destination`，实现 BGM/SFX 分轨音量；接口名与调用点不变。 |

未改动：判定几何、碰撞、玩法层（`src/game/sim.js`、`src/main.js`、相机/球门/车辆几何）全部保持原样。`assets/poster-raw.jpg`、`assets/icon-raw.png` 未引入运行期代码（留给 Lead 做上架物料）。

开发 agent 已接好的部分（turf 地面贴图、sky equirect 背景、BGM 解码循环 + 首交互解锁 + 静音恢复）经检查对齐，未重复造轮子，只补全了缺口。

## 2) 测试通过数

- `node --test`：**23/23 pass**
- `asset-check`：**PASS 3/3**（代码 4/4 素材引用可解析）
- `i18n-check`：**OK**（en/zh 各 43 key，0 missing/empty）
- `tutorial-check`：**PASS**（4 步，可跳过/重放）
- `sdk-check`：**pass=true**（0 console/page error）
- `verify-game`：**pass=true**，fps=60，0 console error / 0 page error / 0 失败请求
- `selfplay`：正常产出 `tools/fun/autoplay.json`（8 条 bot 记录）
- `fun-report`：**PASS（10 pass / 0 warn / 0 fail）**
- `shot.mjs` desktop + mobile：**0 console error / 0 page error / 0 失败请求**

外链仅 `pipygames.com/sdk/*`（SDK 配置探测，sdk-check 已按降级豁免），无其它外链。

## 3) 截图路径

- `tests/final/desktop.png`（1280×720）
- `tests/final/mobile.png`（1688×780 = 844×390 @2x）

## 4) 未做项 / 已知 bug

- `poster-raw.jpg` / `icon-raw.png` 按任务要求不接入运行期（Lead 后续做物料）。
- 天空为 2D `scene.background`（EquirectangularReflectionMapping），俯视广播机位下「球场屋顶剪影」会落在天球地平线附近，非真实天穹 mesh——按任务二选一方案取前者。
- selfplay greedy bot 推进到第 3 关后停住（`completed=false`）：属玩法/难度调参，非本次美术音频接线范围，未动。

## 5) 最不满意一处

围栏：`wall.webp` 自带一条霓虹绿 trim，而代码里每面墙顶部另有一条 `toneMapped:false` 的霓虹 trim mesh，二者叠加后墙顶边缘可能显得「双描边」。选择保留原 trim mesh（视觉件、不碰玩法），代价是贴图自带的 trim 与 mesh trim 竞争。

> 说明：本会话 Read 工具对 PNG/JPEG 返回 Unsupported，未能肉眼复核截图；视觉正确性以 0 console/page error、0 失败请求、fps=60 及素材 200 加载为准。
