# lantern-isle-3d 3D 运行时架构

系统拆分（谁只负责什么，越界就是返工）：
- `src/core/base3d.js` 舞台/固定步长/输入/池
- `src/core/glb.js` data-URI GLB 加载（角色带 AnimationMixer）
- `src/core/character.js` 第三人称控制器 + 动画状态机 + 轨道相机
- `src/core/world.js` 高度场地形/光照昼夜/分区/实例化散布
- `src/core/debug-bridge.js` `window.__game3d` 观察面（probe 用）
- `src/ai/npc-agent.js` NPC 意图→结构化→规则校验→记忆（纯逻辑，可单测）
- `src/game/sim.js` **纯玩法逻辑**，不碰 DOM/THREE，`node --test` 直接测
- `src/render/index.js` 只读 sim 状态渲染；`src/ui/ui.js` HUD/屏

运行期零网络请求：所有 GLB/贴图/音频本地打包，SDK 是唯一允许的外部脚本。
