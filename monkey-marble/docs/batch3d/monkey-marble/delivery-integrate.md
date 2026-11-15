# MONKEY MARBLE · 美术/音频接线交付

## 1) 改了哪些文件

开发 agent 已把大部分素材接好，本轮做对齐/补全，只动两处：

- `src/render/index.js`
  - 天空：`assets/sky.jpg` → 天穹 mesh（`SphereGeometry(420)` BackSide + `MeshBasicMaterial.map`，`fog:false`）；加载失败回退纯色天穹（`COLORS.sky`）。`scene.background` 同为纯色兜底。
  - 贴图：`assets/tex/track.webp` → 赛道 ribbon 材质 `map`（`RepeatWrapping`，UV 按几何 `v = z/6` 每 6 单位循环，`u` 0..1 跨整宽）；`assets/tex/monkey.webp` → 球内猴子面片 `map`。
  - **本轮补**：track 贴图晚于 ribbon mesh 构建到位时，回调里给已建材质补接 `map`（原先只挂 `tex.track`，晚到则赛道永远纯色；猴子面片本就补接了 `material.map`）。
  - 仅替换材质 `map`，**碰撞/命中/判定几何一律未动**（ribbon/香蕉/锤/板/终点位置与尺寸原样，渲染层读同一份 sim 状态与 `createTrack` 几何）。
- `src/core/audio.js`
  - BGM：`assets/audio/bgm.mp3` 解码循环播放（首次 `unlock()` 交互后起播）；master 链路 `master → DynamicsCompressor → analyser → destination`，master gain 0.9、BGM 独立 `bgm.gain`（0.4）分轨、SFX 走 master，峰值 ≤0.9。
  - **本轮补**：静音改为真正「掐断 + 记录 offset + 恢复从该 offset 续播」（原先 master gain=0 只静音、源继续走、位置不停；暂停/静音/结算后 `_fileStart` 一律从 `b.offset` 续播）；文件缺失/解码失败回退程序化 marimba。
  - SFX 保留程序化 WebAudio 合成兜底，接口名 `unlock()/setMuted()/muted()/play(name)` 与调用点不变。

未引用 `assets/poster-raw.jpg` / `assets/icon-raw.png` 进游戏代码（Lead 后续做物料）。

## 2) 测试通过数

| 命令 | 结果 |
| --- | --- |
| `node --test` | 19/19 pass（0 fail） |
| asset-check | PASS 3/3（4/4 代码素材引用可解析；poster/icon 未引用） |
| i18n-check | OK（en/zh 各 38 key，0 missing/empty） |
| tutorial-check | PASS（4 steps，可跳过/回放/持久化） |
| sdk-check | pass（10 checks，0 console/page error，0 失败请求） |
| verify-game | pass，fps 60，16 steps 全 ok，0 console/page error，0 失败请求，0 外链 |
| selfplay | greedy 3/3 通关（S 评级，5 关），random/noinput 基线正常 |
| fun-report | PASS（10 pass / 0 warn / 0 fail） |
| shot desktop / mobile | 0 console error / pageerror / 404 / 外链 |

## 3) 截图路径

- `tests/final/desktop.png`（标题屏 1280×720）
- `tests/final/mobile.png`（844×390）
- `tests/artifacts/01-title.png` / `01b-title-zh.png` / `02-playing.png` / `03-roll.png` / `04-pause.png` / `05-results.png`（verify-game 全流程）

## 4) 未做项 / 已知 bug

- `assets/poster-raw.jpg`、`assets/icon-raw.png` 未进运行期渲染（按要求，Lead 后续做物料）。
- `tex/track.webp`、`tex/monkey.webp` 带 alpha 通道（均值 0.984，仅角落透明），材质不透明故直接取 RGB；四角透明处 RGB 略深，在 `RepeatWrapping` 平铺下偶现极淡的边角暗纹，肉眼几乎不可见。
- 猴子是「正面脸贴图」，用 `PlaneGeometry` 面片贴在透明球内是唯一忠实映射；无 3D 头部几何可包。

## 5) 最不满意一处

球内猴子是**平的面片**：`monkey.webp` 是单张正面脸贴图，只能用 `PlaneGeometry(0.6,0.6)` 贴在透明球壳里。球滚动时猴子不随球翻面、窄桥时只做 `rotation.y` 左右摆头，观感是「一张脸贴在玻璃珠里」而非「猴在珠里」。这是素材形态（单张正面贴图、无 3D 头模）决定的，要在珠里做出立体猴子需另出一套 3D 头部几何或至少三视角贴图，本轮未做。
