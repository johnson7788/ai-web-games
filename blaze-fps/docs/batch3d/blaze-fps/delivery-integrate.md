# BLAZE FPS · 美术/音频接线交付

开发 agent 已接好大部分素材（天空 / tex 贴图 / BGM 解码循环均已落地），本 agent 做对齐质检 + 补全，不重造轮子。只改 `src/` 两个文件，玩法层（sim）与判定几何零改动。

## 1) 改了哪些文件

**src/render/index.js**
- 天空失败回退由纯色 `Color(0x0b0e1a)` 改为程序化渐变 `CanvasTexture`（夜空→地平线余烬），sky.jpg 加载成功仍用 Equirectangular 替换。
- 贴图从「每图一份共享材质、repeat 硬编码 4×4」改为「预加载一次 → 每 mesh 克隆纹理 → 按几何尺寸设 repeat」。
  - 地面 `rep(size*2, size*2, 4, 4)`；墙 `rep(长边, h, 4, 2)`；矮掩体木箱 `rep(w, h, 2.4, 2.4)`；高掩体金属 `rep(w, h, 4, 2)`。
  - 修掉一个接线 bug：侧墙 BoxGeometry 的薄边（0.4）被当成了墙面跨度，导致侧墙贴图横向 1 repeat 严重拉伸 → 改为取 `max(w, d)`。
  - 贴图未到位时材质保持纯色，到位后重建当前图替换（不白屏不 undefined）。
  - 删除死代码 `wallMats` Map。

**src/core/audio.js**
- 补 `sfx` 分轨 GainNode：`_envelope`/`_noise` 走 `sfx → master`，BGM 仍走 `bgm.gain → master`，实现 BGM/SFX 独立音量。
- master 保持 `DynamicsCompressor` 链（master 0.85 / BGM 0.5 / SFX 1.0，峰值 < 0.9）。
- 接口名与调用点不变（unlock/setMuted/muted/play/event）。

## 2) 测试通过数

| 检查 | 结果 |
| --- | --- |
| `node --test` | 24/24 pass |
| asset-check | PASS 3/3（5/5 引用可解析，6 素材） |
| i18n-check | OK（en 81 / zh 81，0 missing/empty） |
| tutorial-check | PASS（4 步，可跳过/可重放） |
| sdk-check | pass（10/10，含降级） |
| verify-game | pass，fps 60（avgFrameMs 16.66），0 console/page error，0 失败请求，0 外部请求 |
| selfplay | greedy ×3 completed=true（lvl 15），random/noinput 基线正常 |
| fun-report | PASS 10 pass / 0 warn / 0 fail |
| shot desktop / mobile | 0 console/page error，0 failed，0 external |

运行时探针确认：`scene.background` 为 sky.jpg 纹理；11 个地图材质带贴图，repeat 采样 `[9,9]`(地) `[9,2]`(墙×4) `[1,1]/[2,1]`(掩体)，与几何对齐。

## 3) 截图路径

- `tests/final/desktop.png`（1280×720）
- `tests/final/mobile.png`（1688×780）
- `tests/artifacts/01-title.png` … `05-mobile-playing.png`（verify-game 全流程）

## 4) 未做项 / 已知 bug

- `assets/poster-raw.jpg`、`assets/icon-raw.png` 未进运行期渲染（按规格留给 Lead 做物料），代码零引用。
- `assets/audio/bgm.wav`（8.5MB 源文件）仍在目录里但未被引用，只用 `bgm.mp3`（774KB）；是否清理由素材侧决定。
- webp 贴图带 alpha 通道（manifest `alpha:true`），以 `transparent:false` 的 map 使用，alpha 被忽略——木箱/金属/水泥均为不透明，符合预期。

## 5) 最不满意一处

掩体是 BoxGeometry，单个材质/贴图只能对所有面用同一 repeat：长条形矮木箱（4.0×1.2×1.5）正面 2 repeat 合适，但 1.2 宽的端面被压成半箱。三.js 单 Box 无法按面设 repeat；若后续在意可拆六面 UV，当前低多边形风格下可接受。
