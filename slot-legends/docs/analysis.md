# 源码分析 — slot-legends（参考 Cocos Creator 水浒传）

> 事实带 `文件:行号`。源码路径：`/Users/admin/remake-src/cocos-creator水浒传/fans180-LingChongZhuan-master/LingChongZhuan/`

## 重要结论：源码实际是「回合制自动战斗剧情」，不是老虎机

spec 里标注「Level/enemy/player 3 js：老虎机滚动轮」，但源码里**没有** Level.js / enemy.js / player.js，
也**没有**任何老虎机滚动轮逻辑。实际脚本只有 7 个 `assets/Script/*.js`，是一个「水浒 IP 自动战斗剧情生成器」：

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `assets/Script/Main.js` | 16 | 章节卡片的「返回」按钮（`onClickBack` 隐藏节点，`Main.js:13-15`） |
| `assets/Script/Menu.js` | 63 | 入口菜单：初始化 LCLevel/LCExp 存档、播放 BGM、`goToChapter(chapter)` 进入章节（`Menu.js:35-38`）、章节 1-6 + 训练关按钮 |
| `assets/Script/Story.js` | 247 | 剧情主循环：`init(chapterIdx)` 加载章节/角色数据（`Story.js:38-69`）、`startStory` 摆放 12 个角色（`Story.js:71-122`）、`update(dt)` 驱动 `tellStory()` 逐条播放剧情（`Story.js:240-246`） |
| `assets/Script/StoryGenerate.js` | 143 | 战斗结算：按 speed 排序轮流攻击，30 回合内定胜负，产出 talk/attack/injured/dead/end 事件序列（`StoryGenerate.js:42-120`） |
| `assets/Script/Hero.js` | 30 | 角色血条与死亡（`updateShowBloodRate`、`dead` 销毁节点） |
| `assets/Script/ExpPanel.js` | 36 | 结算经验/升级（`showExp` 累加 LCExp，超过 `lcLevel*100` 升级，`ExpPanel.js:14-30`） |
| `assets/Script/ChatPlace.js` | 31 | 对话气泡 + 头像加载 |

### 源码的五个关键事实（作为「同类结构」参考，非玩法依据）

1. **入口**：`Menu.js:13-22` 首次进入写 `LCLevel=1 / LCExp=0` 到 `cc.sys.localStorage`；`Menu.js:35-38` 按章节号跳 `Story.init(chapter)`。
2. **主循环**：`Story.js:240-246` 的 `update(dt)` 是唯一每帧入口，`canTellStory` 为 true 时推进一条剧情事件。
3. **输入**：`Story.js:231-237` `onClickNext`（500ms 点击节流）、`Story.js:33-36` `onClickEnd` 关闭面板 —— 纯点击驱动。
4. **判定**：`StoryGenerate.js:42-120` —— 战力 = attack×随机(0.8~1.1)，30 回合上限，一方死光定胜负（`fightResult` 1=win / -1=lose）。
5. **关卡/UI**：`Menu.js:40-61` 章节按钮 + `ExpPanel.js` 升级结算卡 + `ChatPlace.js` 对话气泡。

### 对 slot-legends 改造的指导

- 源码无老虎机机制，因此 **P0 玩法（滚动轮/停止/连线判定/倍率表/余额下注/免费旋转）按 spec 从零实现**，不还原源码。
- 可借鉴的「结构」：`Menu.js` 的章节选择 → 对应本作 12 级推进结构；`ExpPanel.js` 的经验升级 → 对应本作 spins 计数的 12 级解锁；`Story.js` 的 `canTellStory` 逐条推进 → 对应本作 `spin → settle → next` 的单步状态机。
- **全原创化**：水浒 36 好汉 → 6 个原创「侠盗传说」符号（刀客/神偷/酒仙/镖师/官府/元宝）+ 聚义令（scatter）+ 好汉（wild）；不引用任何原作图片/命名。
