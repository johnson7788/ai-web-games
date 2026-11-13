channel: online
channelCondition: "优先 polyfork 3D 资产库；仅库内无对应资源时才启用线上 ComfyUI，启用前必须 comfy_tunnel.py --check 输出 [check] OK"
channelTriggered: false
framing: three
style: 3d-cartoon
styleNote: "用户选『电影级写实观感』；真 3D 路线角色只能 low-poly，靠程序化 PBR/雾/软阴影/AgX/bloom/暗角/颗粒把质感拉到 3A 档次"

# 资产来源决策（Step 3 执行前先搜库）

## 1. 3D 模型（本地 GLB，polyfork；零生图）
- 角色：`teen-zombie-b5bb27`（Teen Zombie，4951 tris，1.61×1.56×0.49m，clips Idle/Walk/Run，halloween-night kit）
- 备选/变体：`villager-40255c`（Male Villager，3735 tris，同三套 clip，medieval-village kit）、`ashigaru-foot-soldier-806707`
- 场景道具：优先 `halloween-night-46ade4` 整 kit（枯树、墓碑、南瓜、围栏、火堆），补 nyc / countryside 的建筑与箱体
- 规则：同 kit 内挑件；`pool.spawn(id,{clip:'Idle'})` + 主循环 `inst.update(dt)`；蒙皮克隆必须走封装的 SkeletonUtils
- 许可：只拷 GLB 进游戏包，不引用 `polyfork.dev/cdn/*.mjs`；SEO.txt 与关于面板署名 Polyfork

## 2. 场景 / 天空 / 材质（程序化，零生图）
- 阴雨夜空 + 血月 + 体积雾：GLSL 程序化天空（参考 3D射击DEMO `SALTLINE_SKY`，换废土配色）
- 地面：世界坐标噪声生成湿沥青 / 泥地 + 水洼镜面 + 程序化法线
- 光照三层：半球环境光 + 带 PCSS 软阴影的定向月光 + 体积光柱
- 后处理：AgX 色调映射 → bloom → 色差（受击增强）→ 暗角 → 胶片颗粒 → 抖动去带
- 特效：枪口火焰 / 弹壳 / 血雾 / 命中火花 / 落地尘，全部代码粒子，0 次生图

## 3. UI（零生图）
- 组件：准星、生命环、弹药块、顶部波次链、敌人血条、小地图、金币、商店/背包/暂停/结算面板、模式三卡、区域选择 10 卡、开屏
- 世界观主题：`wasteland` + 青灰战术 HUD（描边 / 硬底边阴影 / 四态），全部 CSS + 内联 SVG；**面板四角必须完整，不用 clip-path 切角**
- 关卡缩略图（2026-11-12 补）：`tools/gen_assets.py → generate_cards()` 用 Pillow 程序化渲染 10 张 `sectors/sector-01..10.webp`（360×220）+ 3 张 `modes/*.webp`（560×320），逐关偏移月位、色温、尸群密度、火光与首领剪影；仍属代码产物，**未触发生图通道**。DOM 侧只用 `style.backgroundImage`，不拼 innerHTML

## 4. 海报
- `poster.jpg` 用 Pillow 程序化渲染（血月 + 剪影城市 + 尸群 + 第一人称枪械与枪口火光），≤200KB / ≤800px，属代码产物不是生图。**刻意不画任何文字**：它既是 og:image，也是开屏整屏底图；游戏名若画进图里会与开屏 DOM 的艺术字标题叠成两层。开屏由 `art.poster` 声明、`src/main.js::attachPoster()` 解码成功后注入 `#boot-bg`；四段（艺术字游戏名 → 大进度条 → 左百分比/右 pipygames.com）全部是 DOM/CSS，进度由 `preloadArt` 驱动

## 5. 音频（纯 WebAudio 合成，零采样文件）
- 运行时 `AudioContext` 实时合成：rifle_shot（瞬态+低频体感+尾音反射）、reload、dry_fire、impact、headshot、zombie_growl（声带脉冲+共振峰+湿噪）、zombie_hurt、zombie_die、player_hurt、footstep、wave_start、boss_roar、ui_click、win、lose
- BGM：合成激扬战斗循环（鼓组 + 失真 bass + 铜管式 pad + 16 分音 arp，132 BPM，无缝循环），波次升级时加层
- `tools/gen_audio.py` 用 numpy 离线渲染同算法的 WAV 镜像，归档 `local/audio/AI_GEN/sfx`，并让 `game.config.js → audio.files` 与 `assets/audio/` 一致（校验 F4）；运行时优先实时合成，WAV 仅作降级/归档

## 缺口（触发线上 ComfyUI 的条件）
- 当前盘点：资产库覆盖角色与场景道具，天空/材质/海报/音频全部程序化 → **缺口 0，未触发生图，无需起隧道**。
- 若后续目检发现需要写实环境贴图（资产库确实没有），则先起隧道 `--check` 验证连通，再 `comfy_gen.py batch` 生成，并把 `channelTriggered` 改为 true、在 decisions.md 追加一条来源记录。
