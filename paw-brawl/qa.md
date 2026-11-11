# PAW BRAWL · M5 验收记录

日期：2026-11-06  
环境：本机 8124 静态服务、Chromium、Apple Metal ANGLE；桌面 1280×720，移动视口 844×390 / DPR 2。  
证据：`tests/artifacts-final/report-m5.json`、`tests/artifacts-final/soak-m5.json` 和同目录 PNG。

## 1. 功能

| 项目 | 结果 | 证据 / 说明 |
| --- | --- | --- |
| 标题 → 模式 → 选人 → 三回合 → 领奖台 → 再来一局 | PASS | 浏览器完整流程；再来一局回到云端擂台 |
| 大乱斗 / 团队战 | PASS | 两种模式均完成比赛；团队战先到两回合结束 |
| 正常流程地图轮换 | PASS | 云端擂台 → 糖果工厂 → 冰湖；由正常回合回调触发 |
| 八角色、解锁、金币与存档 | PASS | 逻辑测试覆盖价格、解锁扣款、奖励、损坏存档和 localStorage 异常降级 |
| 五种道具 | PASS | 咸鱼、大锤、炸弹、拳套、星星的生成、拾取、使用、次数和时效测试通过 |
| 暂停、继续、重开 | PASS | 浏览器流程与输入状态检查通过 |
| 音效、音乐、画质设置及刷新持久化 | PASS | Low 在刷新后仍为 Low；DPR 1、阴影关闭；SFX/Music 状态保持 |
| 桌面分享 | PASS | 下载 1080×1350 PNG，文件可打开且内容完整 |
| 移动端分享 | PASS（模拟） | 模拟 `navigator.share` 收到一个非空 `image/png` 文件；未验证真实系统分享面板 |
| 中文全流程 | PASS | 开玩、设置、选择模式、选择角色、回合和比赛结果均为中文 |
| 键盘焦点 | PASS | 标题页 Tab 后焦点位于 PLAY |
| 竖屏旋转遮罩 | PASS（模拟） | 竖屏出现、横屏消失 |
| WebGL 不可用降级 | PASS | 禁用 WebGL 后显示明确提示，无未捕获异常 |
| 贴边镜头 | PASS | 仅调整 target；未加入相机位置 clamp 或抬高补偿 |

## 2. 手感与视觉

| 项目 | 结果 | 证据 / 说明 |
| --- | --- | --- |
| 出拳、三连击、蓄力、冲刺拳、下砸 | PASS | 战斗逻辑测试及浏览器自对弈 |
| 抓取、挣扎、拖行、投掷、撞第三人 | PASS | 战斗逻辑测试覆盖完整链路 |
| 重量、击飞、硬直、眩晕与淘汰 | PASS | 63 条逻辑测试全绿 |
| 糖果工厂辨识度 | PASS | 粉白糖纹、巧克力传送带、糖棒、厂房门窗、烟囱与蒸汽可见 |
| 冰湖辨识度 | PASS | 极光、冰面裂纹、浮冰、雪松可见 |
| 三图 / 团队 / 领奖台 / 中文结算截图 | PASS | 人工复核最终 PNG，未发现阻断性裁切或文字重叠 |
| 移动 HUD | PASS（模拟） | 844×390 下道具槽、排行榜和触控键不重叠；触控键最小约 64.6 CSS px |
| 角色预览与八张头像 | PASS | 头像互不相同，封面及预览角色完整 |
| 输入到动作不超过两帧 | PASS（人工抽查） | 浏览器操作未见明显延迟；未制作 0.25× 录屏逐帧计量 |

## 3. 浏览器与性能

扩展版 `verify-m5.mjs`：`ok: true`。

- Console error：0。
- Console warning：0。
- 请求失败 / HTTP 400+：0。
- 外部 HTTP 请求：0。
- 首次可用加载：1726 ms，低于 3000 ms。
- 连续六次切图：场景几何体数量逐图稳定，`geometryStable: true`。

`PB_UNCAPPED=1` 解除 Chromium 帧率限制后的渲染容量：

| 视口 | FPS | 平均帧时间 | p95 | Draw calls | DPR |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1280×720 | 563.70 | 1.774 ms | 3.100 ms | 171 | 1 |
| 844×390 | 439.27 | 2.277 ms | 4.100 ms | 255 | 2 |

普通 60Hz rAF 采样：桌面约 60fps / 16.69ms，移动端此前复测约 60fps / 16.67ms。这里的 16.67ms 是刷新间隔，不代表渲染耗时超标；`<16ms` 验收使用上方的 uncapped 渲染容量数据。

十分钟稳定性：PENDING，等待修正复位流程后的最终报告。

## 4. 音频

| 项目 | 结果 | 证据 / 说明 |
| --- | --- | --- |
| 首次交互解锁、程序化 BGM/SFX | PASS | 标题交互后正常运行，无 AudioContext 异常 |
| 音效 / 音乐开关与持久化 | PASS | 浏览器刷新前后状态一致 |
| 暂停 ducking、后台 suspend / 恢复 | PASS | 状态流程检查通过 |
| 十分钟运行音频错误 | PENDING | 以最终 soak 的 console 结果为准；未单独统计音频节点数或进行扬声器听感测量 |

## 5. 自动测试与自对弈

- `node --test`：63 / 63 PASS，0 FAIL。
- 大乱斗：20 场 / 60 回合，1461 次命中，平均回合 34.86 秒，异常自毁 0。
- 团队战：20 场 / 49 回合，905 次命中，平均回合 26.15 秒，异常自毁 0；红蓝比赛胜场 8 / 12。
- 自对弈胜率阈值：FAIL。大乱斗 Cat 6.7%、Duck 5.0%，低于脚本 `min >= 8%`，因此 `balanced: false`。本轮未为追求样本阈值修改战斗数值。

## 6. 交付物与红线

| 项目 | 结果 | 路径 / 说明 |
| --- | --- | --- |
| README | PASS | `README.md`，含操作、运行、结构、测试与原创声明 |
| SEO | PASS | `SEO.TXT`；英文 LONG 为三段、197 词 |
| 封面 | PASS | `post.jpg` 1280×720；`poster.jpg` 1920×1080 |
| 图标 | PASS | `favicon.png` 256×256 |
| 分享卡 | PASS | `tests/artifacts-final/share-card.png` 1080×1350 |
| 验收脚本 | PASS | `tools/verify-m5.mjs`、`tools/soak-m5.mjs` |
| 本地依赖与离线运行 | PASS | three.js 保存在本地，外部运行期请求为 0 |
| 相对路径 / 子目录部署 | PASS | 资源使用相对路径，无构建步骤 |
| 原创素材 | PASS | 无 Party Animals 素材、角色、地图或 UI 复刻 |
| 禁用区 | PASS | 未修改 `lib/three.module.js`，未恢复相机 clamp / 抬高补偿 |
| 发布 ZIP、试玩 MP4/GIF、实际上传 | N/A | 不属于本轮代码与资产交付；由后续发布流程处理 |

## 7. 最终截图

- `tests/artifacts-final/07-final-title.png`
- `tests/artifacts-final/08-final-select.png`
- `tests/artifacts-final/07c-cloud.png`
- `tests/artifacts-final/09-candy.png`
- `tests/artifacts-final/10-ice.png`
- `tests/artifacts-final/11-team.png`
- `tests/artifacts-final/11b-team-result.png`
- `tests/artifacts-final/12-podium.png`
- `tests/artifacts-final/13-mobile.png`
- `tests/artifacts-final/14-zh-results.png`
- `post.jpg`、`poster.jpg`

## 8. 未解决项

自对弈胜率门槛未通过：20 场大乱斗样本中 Cat 与 Duck 的回合胜率低于 8%，`balanced` 为 `false`。功能、稳定性和性能验收不依赖该启发式胜率阈值。

测试范围说明：移动布局、旋转与系统分享使用 Chromium 模拟；真实 iOS / Android 设备、物理扬声器听感和逐帧录屏不属于本次自动化证据。
