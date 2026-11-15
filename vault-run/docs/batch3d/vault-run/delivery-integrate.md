# VAULT RUN · 美术/音频接线交付

## 1) 改了哪些文件

开发 agent 已完成大部分接线（天空、BGM、SFX 分轨、master 压缩器均已就位）。本次只补两处缺口，共改 **1 个文件**：

| 文件 | 改动 |
| --- | --- |
| `src/render/index.js` | ① 贴图按几何尺寸铺 tile：新增 `tileMat()`，同图只 `TextureLoader.load` 一次、每 mesh `texture.clone()` 后按几何尺寸设 `repeat`（屋顶混凝土每 4m 一块、砖墙水平每 2m / 层高 0.6m），替换掉原先「RepeatWrapping 但 repeat=(1,1)」导致的整张贴图拉伸。② 天空加载失败回退由「纯色 `PALETTE.fog`」升级为程序化渐变天空 `gradientSky(PALETTE.sky → PALETTE.fog)`（`CanvasTexture` 垂直渐变，地平线色与 fog 同色避免接缝）。 |

开发 agent 已就位、本次**未再改动**的部分：天空 `sky.jpg → scene.background(EquirectangularReflectionMapping)`、`bgm.mp3` 解码循环 + synth 兜底、`DynamicsCompressor` 峰值 ≤0.9、BGM/SFX 分轨 gain、静音用 master gain 掐断/恢复保留当前位置、SFX 程序化接口（`unlock/setMuted/muted/play`）与调用点。

未改动：`src/game/sim.js`、`src/game/course.js`（碰撞/命中/判定几何全保留）、`src/main.js`、`src/ui/`、SDK、任何 skills 目录。

## 2) 测试通过数

- `node --test`：**21/21 通过**
- `asset-check`：PASS 3/3，代码内 4/4 素材引用可解析（sky/roof/brick/bgm；poster-raw、icon-raw 未进运行期代码）
- `i18n-check`：OK（en/zh 各 60 键，0 缺 0 空）
- `tutorial-check`：PASS
- `sdk-check`：pass，0 console/page error，0 失败请求（SDK 自身除外），域名锁降级正常
- `verify-game`：pass，fps **60**（≥50），0 console error / 0 pageerror / 0 404；外链仅 pipygames SDK config（平台接入必需，已按降级处理）
- `selfplay`：8 局遥测正常（greedy 三局跑满至 level 5 通关，random/noinput 作基线）
- `fun-report`：PASS（10 pass / 0 warn / 0 fail）
- `shot`（desktop 1280×720 / mobile 844×390）：0 console/page error、0 failed requests

## 3) 截图路径

- `tests/final/desktop.png`
- `tests/final/mobile.png`
- 流程截图（verify-game）：`tests/artifacts/01-title.png` … `05-results.png`、`mobile-title.png`、`mobile-game.png`

## 4) 未做项 / 已知 bug

- **未做**：`assets/poster-raw.jpg`、`assets/icon-raw.png` 按约定不进运行期渲染（Lead 后续做上架物料），已确认代码内无引用。
- **未做**：`assets/audio/bgm.wav`（源文件）未引用、未删除，保留给 Lead 处理（mp3 已够用）。
- **已知 flake**：`verify-game` 的「冲线结算」断言在 headless 下 ~20–25% 概率偶发失败（约 8 次 2 次），现象为 1400ms 等待窗口内未等到 `state==='results'`。该断言通过「瞬移 + 1.4s 等」判断冲线，依赖 rAF 节拍；每次失败时 0 console/page error、fps 60、游戏自身 `node --test` 21/21 全绿，与本次渲染改动无关（本次仅动 `src/render/index.js`，不触 sim/状态机），属验收脚本时序问题，未改 `tools/verify.plan.json` 与任何 skills。
- **已知小瑕疵**：BGM 暂停（`pauseGame`→`stopAll`）是真正停源、恢复时从头播放；而「静音」按钮走 master gain 掐断、恢复保留当前位置（符合「静音掐断/恢复从当前位置」需求）。暂停≠静音，恢复不会精确接上暂停瞬间，可接受。

## 5) 最不满意一处

屋顶贴图 `roof.webp` 是「俯视混凝土」原画，但被整块 `BoxGeometry` 贴到屋顶实心块的 **6 个面**——顶面铺 tile 正确，四个 0.5m 高的侧面也贴着同一张俯视混凝土，形成不自然的纹理侧带。理想做法是给屋顶单独做 top-only 材质（用 multi-material 或独立顶面 plane），侧面回退纯色；本次为控制 diff 未拆，low-poly 风格下可接受，若 Lead 觉得侧带刺眼再拆面。
