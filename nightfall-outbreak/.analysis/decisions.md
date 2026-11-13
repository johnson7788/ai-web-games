# 决策留痕

格式：`决策点 | 结果 | 来源`

渲染路线 Q1 | `three`（真 3D 场景：three.js + PerspectiveCamera + 本地 GLB 骨骼动画） | 用户选择
造型风格 Q2 | 电影级写实观感；落地 `art.style = "3d-cartoon"`（真 3D 路线唯一合法造型枚举）+ 影视级程序化光照/雾/后处理 | 用户选择
造型能力边界 | 已如实告知：真 3D 路线角色只能 low-poly 骨架模型，无 Pixar 级高模绑骨产线；用户接受 | 用户选择（问题卡已说明）
生图通道 Q3 | 优先 3D 资产库（polyfork 本地 GLB）；仅库内无对应资源时才启用 `online` 线上 ComfyUI，启用前必须先 `comfy_tunnel.py --check` OK | 用户选择（自定义答案）
音效方案 Q4 | 纯 WebAudio 实时合成（不加载真实采样文件）；枪声=多层噪声瞬态+滤波+卷积尾音，僵尸声=声带脉冲+共振峰噪声，BGM=合成鼓组+失真低音+铜管推进 | 用户选择
关数 | 10 关（2 章 × 5 关：teach/practice/twist/test/breath） | 用户未指定，主代理按技能骨架定
slug | `nightfall-outbreak` | 主代理定（原创命名，不临摹原作标题）
游戏名 | `NIGHTFALL: OUTBREAK` / 中文名 `夜幕爆发`（仅配置留档，页面默认英文零中文） | 主代理定
广告点位 | `revive` / `doubleCoins` / `assist` 三个激励位 + `stageClear` 插屏 | 技能默认口径，ads-design.md
