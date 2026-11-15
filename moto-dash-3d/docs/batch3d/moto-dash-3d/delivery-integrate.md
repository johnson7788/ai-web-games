# MOTO DASH 3D · 美术/音频接线交付

## 1) 改了哪些文件

| 文件 | 改动 |
| --- | --- |
| `src/render/index.js` | 接入 3 张 AI 素材：`assets/sky.jpg` → `scene.background`（EquirectangularReflectionMapping，加载失败回退程序化渐变天空）；`assets/tex/road.webp` → 路面材质 `map`（RepeatWrapping，按几何尺寸 repeat≈4m/格，与车道线同相位滚动）；`assets/tex/cockpit.webp` → 驾驶舱面板材质。`updateTheme` 用 `scene.backgroundIntensity`（按 `SEGMENTS.skyI`）随昼夜压暗天空，不再逐帧覆盖 background。 |
| `src/core/audio.js` | 修 BGM 静音后不回恢复的 bug（`unlock()`/`resume()` 恢复 `bgm.gain`，菜单/暂停回游戏后 BGM 不再永久哑掉）；新增 SFX 分轨 gain（`sfx` 总线接 master），三处 `_tone/_noise/_toneAt` 改走 `this.sfx`，满足「BGM/SFX 分轨音量」。 |
| `config/game.config.js` | `SEGMENTS` 每段新增 `skyI`（day 1.0 / dusk 0.6 / night 0.3），驱动天空贴图昼夜亮度。 |

未改动：`src/game/sim.js`（碰撞/命中/判定几何全保留）、`src/main.js`、`src/ui/`、SDK 与任何 skills 目录。

## 2) 测试通过数

- `node --test`：**18/18 通过**
- `asset-check`：PASS 3/3，代码内 4/4 素材引用可解析（sky/road/cockpit/bgm；poster-raw、icon-raw 未进运行期代码）
- `i18n-check`：OK（en/zh 各 48 键，0 缺 0 空）
- `tutorial-check`：PASS
- `sdk-check`：0 console/page error，0 失败请求（SDK 自身除外），域名锁降级正常
- `verify-game`：pass，fps **60**（≥50），0 console error / 0 pageerror / 0 404 / 0 外链
- `selfplay`：8 局遥测正常（greedy 三局跑满 200s 至 level 5）
- `fun-report`：pass（死亡比例 63% ≥50% 阈值）
- `shot`（desktop 1280×720 / mobile 844×390）：0 console/page error、0 failed/external requests

## 3) 截图路径

- `tests/final/desktop.png`
- `tests/final/mobile.png`
- 流程截图（verify-game）：`tests/artifacts/01-title.png` … `05-results.png`

## 4) 未做项 / 已知 bug

- **未做**：`assets/poster-raw.jpg`、`assets/icon-raw.png` 按约定不进运行期渲染（Lead 后续做上架物料）。
- **未做**：`assets/audio/bgm.wav`（9.8MB 源文件）未引用、未删除，保留给 Lead 处理（mp3 已够用）。
- **已知小瑕疵**：BGM 走文件循环时，暂停/回菜单用的是 gain 掐断而非真正停源（静音期间音频仍在时间轴上推进），因此「恢复」是回到当前时间点而非暂停点——这与需求「静音掐断/恢复从当前位置」一致，但暂停≠静音，恢复后不会精确接上暂停瞬间。可接受，如需严格暂停语义再改 `stopAll` 记录 offset。
- **合成 BGM 兜底**：仅当 `bgm.mp3` 解码失败才走 synth，本次 bgm.mp3 正常解码，synth 路径未在浏览器实测（仅 code review）。

## 5) 最不满意一处

驾驶舱 `cockpit.webp` 是一张「正面视角整车头」原画，而游戏是低多边形第一人称，把它压到一块 `0.92×0.62` 的平面当仪表板，真实感与周围 low-poly 车把/油箱存在风格断层，且画面里同时存在程序化橙色油箱 + 贴图里的油箱，略有重复。理想做法是让 Lead 重出一张「俯视油箱/仪表」切图或纯仪表板贴图，我再贴到油箱顶面。
