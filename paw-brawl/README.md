# PAW BRAWL / 爪爪大乱斗

> 在线试玩：https://pipygames.com/games/paw-brawl-3d-animal-party-fighting-game-rnsz

一款可直接在浏览器运行的原创 3D 动物派对格斗游戏。八只动物在悬浮擂台上出拳、抓取、投掷和使用道具；支持大乱斗、4v4 团队战、三张轮换地图、角色解锁、金币存档与中英文界面。

全部角色、场景、头像、音效、音乐和封面均由代码生成。运行时不请求外部字体、图片、音频或 CDN，无需构建。

## 在线联机

- 直连（低延迟，推荐）：门户内 ONLINE（`/g/<id>/online.html`）
- 创建房间得 4 位码，朋友用码加入；空位机器人补齐；支持 3 回合、断线 30s 重连。
- 新加坡 62000 只监听 127.0.0.1，由 Cloudflare Tunnel 暴露为 wss；门户内 ONLINE 直接进入联机页，不跳 IP。
- HTTPS 环境（pipygames 标题页的 ONLINE 按钮）会打开上面的直连页；北京 8600/8601 在线服已彻底删除。

## 运行

```bash
cd games/paw-brawl
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

必须通过 HTTP 运行，ES Module 不支持直接双击 `file://`。任意静态服务器和子目录均可使用。

调试入口：

- `?lang=zh` / `?lang=en`：覆盖界面语言。
- `?showcase=1`：角色陈列。
- `?poster=1`：隐藏 UI 的封面场景，用于生成宣传图。
- `window.__pb.stats()`：帧时间、FPS、draw call、几何体、纹理、DPR、阴影和画质状态。

## 操作

| 动作 | 键盘 / 鼠标 | 触屏 | 手柄 |
| --- | --- | --- | --- |
| 移动 | WASD / 方向键 | 左半屏动态摇杆 | 左摇杆 |
| 跳跃 | Space | 跳 | A |
| 冲刺 | Shift | 双击摇杆方向 | RB |
| 出拳 / 使用道具 | J / 左键 | 打 | X |
| 蓄力拳 | 按住 J / 左键后松开 | 按住“打”后松开 | 按住 X 后松开 |
| 抓取 / 拾取 | K / 右键 | 抓 | Y |
| 扔出抓住的对手 | J / 左键 | 打 | X |
| 暂停 | Esc / P / ? | 右上暂停键 | — |

空中出拳会下砸；冲刺中出拳会冲刺攻击。咸鱼、大锤、炸弹、拳套和星星均可拾取并使用。

首次进入会弹出 `HOW TO PLAY / 怎么玩` 教程；之后可从标题页的「怎么玩」、暂停面板或 HUD 右上角的 `?` 再次打开。

## 游戏内容

- **大乱斗**：8 只动物，三回合积分赛，最后存活者赢得回合。
- **团队战**：4v4，队友免伤，先赢两回合的队伍获胜。
- **云端擂台**：弹簧板与开放边缘。
- **糖果工厂**：粉色糖纹地面、巧克力传送带、旋转糖棒与厂房。
- **冰湖**：低摩擦冰面、裂纹、极光、浮冰与雪松。
- **八只角色**：柴犬、猫、兔、熊猫、棕熊、狐狸、青蛙、鸭；各有属性和被动。
- **存档**：金币、解锁、战绩、上次角色、语言和设置保存在 localStorage；隐私模式下会安全降级。

正常三回合流程按云端擂台 → 糖果工厂 → 冰湖轮换；再来一局从云端擂台重新开始。

## 测试与验收

```bash
node --test
node tools/selfplay.mjs --rounds 20

# 需要已有 http://127.0.0.1:8124/ 服务和本机 Playwright/Chromium
node tools/verify-m5.mjs
PB_UNCAPPED=1 node tools/verify-m5.mjs
node tools/soak-m5.mjs
```

- `node --test`：63 条纯逻辑测试，覆盖模拟、战斗、输入、AI、相机、比赛和存档。
- `selfplay.mjs`：自动对弈并输出回合时长、击倒、胜率和异常自毁统计。
- `verify-m5.mjs`：完整浏览器流程、三张地图、团队战、设置持久化、中英文、分享、移动布局、性能、封面和资源释放检查。
- `PB_UNCAPPED=1`：解除 Chromium 帧率限制，测量渲染容量；普通模式报告的是 60Hz rAF 间隔，两者不可混为实际显示帧率。
- `soak-m5.mjs`：十分钟战斗与切图稳定性采样。
- 浏览器报告与截图输出到 `tests/artifacts-final/`。

## 目录

```text
config/                 手感、角色、地图、模式与中英文案
src/core/               i18n、存档与分享卡
src/game/               60Hz 纯逻辑模拟、战斗、AI、输入、相机和比赛
src/render/             场景、程序化动物、道具、特效与画质控制
src/ui/                 标题、选人、HUD、结算、头像与触屏控件
src/audio.js            程序化音效、音乐与后台音频管理
src/main.js             装配、固定步长、渲染插值和完整界面流程
lib/three.module.js     本地 three.js r160
tests/                  node:test 回归测试与最终浏览器产物
tools/                  自对弈、浏览器验收和稳定性脚本
post.jpg                1280×720 封面
poster.jpg              1920×1080 宣传图
favicon.png             256×256 图标
SEO.TXT                 上架标题、简介、分类、标签与英文长描述
qa.md                   M5 验收结果
```

运行期状态暴露在 `window.G.Game.sim`。模拟使用固定 60Hz 步长，渲染只读取插值快照，不回写逻辑。

## 原创与依赖

角色、地图、UI 和音频均为原创程序化实现，不包含任何 Party Animals 素材或复刻资产。唯一渲染依赖是仓库内的 three.js r160；无外部运行期资源依赖。
