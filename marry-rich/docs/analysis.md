# 源码分析 — 帮她嫁入豪门（Cocos Creator）

> 源码目录：`/Users/admin/remake-src/帮她嫁入豪门creator/`
> 本文件只记录「事实 + 文件:行号」，作为 MARRY RICH 玩法 1:1 还原的依据；角色/场景/音乐/IP 全原创，不复用任何原素材。

## 1. 入口与场景

- 场景：`assets/Scenes/MainScene.fire`（Cocos 场景，组件引用见 fire 文件）。
- 挂载的组件（`assets/Scripts/Manager/`、`assets/Scripts/UI/`）：`GameManager`、`DataManager`、`UIManager`、`StartPanel`、`GamePlayPanel`、`WinPanel`、`LosePanel`、`AngryPanel`、`EndingPanel` 等。
- `UIManager.ts:13-20`：启动时把所有子面板 `active` 翻一遍再还原（仅做一次显示状态初始化）。

## 2. 主循环与关卡推进

- `GameManager.ts:38-43`：`NextLevel()` 把 `currentLevel++` 后调 `GamePlayPanel.Instance.ShowOn()`——关卡推进的唯一入口。
- `GameManager.ts:13-15`：`currentLevel` / `lastLevel` 记录当前关与「上次离开的关」，用于断点续玩。
- 没有传统 update 主循环（`GameManager.ts:34-36` 的 `update()` 为空）；游戏完全由点击驱动。

## 3. 输入

- 纯点击：`GamePlayPanel.ts:87-95` 给两个按钮 `Button_1` / `Button_2` 注册 click 监听。
- `GameManager.ts:21`：`cc.macro.ENABLE_MULTI_TOUCH = false`（屏蔽多点触控，单点）。

## 4. 关卡数据（核心）

- `LevelData.ts:5-111`：`LevelData.levels` 共 13 关，每关字段：
  - `right` / `wrong`：两个选项文案；
  - `description_start`：题目/情境；
  - `description_right` / `description_wrong`：选对/选错后的结果文案。
- 示例（`LevelData.ts:7-14`）：第 1 关「侍者端来一个碗…」right=「洗手」wrong=「喝掉」，选对=「有见识」，选错=「那是洗手的！！」。
- 本质：**二选一**，一个「正确」一个「错误」，无属性/无好感度/无分支图——这是原作的玩法上限。

## 5. 判定与反馈

- `GamePlayPanel.ts:98-107`：`On_Button_1()`（正确）→ 最后一关则 `EndingPanel.ShowOn(1)`，否则 `WinPanel.ShowOn()`。
- `GamePlayPanel.ts:109-119`：`On_Button_2()`（错误）→ 最后一关则 `EndingPanel.ShowOn(2)`，否则 `AngryPanel.ShowOn()`。
- `GamePlayPanel.ts:77-85`：按钮左右随机互换位置（`Math.random() > 0.5` 交换 `Button_1`/`Button_2` 的 position）。
- `WinPanel.ts:47-49`：胜利面板显示 `description_right`。
- `AngryPanel.ts:46-75`：错误时播放「生气」动画（两个 element 依次 tween 入场），1.2s 后切到 `LosePanel`。
- `EndingPanel.ts:57-70`：两个结局 `ending1` / `ending2`（最后一关对/错各对应一个）。

## 6. 体力（FTG）系统

- `DataManager.ts:11-13`：`configVo = { FTGNumber: 3, maxFTGNumber: 3, lastShareVideoTime: null }`，持久化到 `cc.sys.localStorage`（key `JRHMConfigVo`，见 `DataManager.ts:20-46`）。
- `StartPanel.ts:50-66`：开局扣 1 体力（`ShuaiFunction.ChangeFTG(-1)`），体力不足弹 `WatchVideoAddFTGPanel`。
- `WinPanel.ts:79-88`：点「继续」再扣 1 体力并 `NextLevel()`，不够则看视频加体力。
- `ShuaiFunction.ts:77-92`：`SetFTG` / `ChangeFTG` 改体力并广播 `changeFTG` 事件。

## 7. 音效

- `AudioManager.ts:40-48`：挂多个 `cc.AudioSource`（bgm / win / lose / leave / drop / jump / hit / type / chat / eat），无程序化合成，全依赖外部音频资源。

## 8. 还原结论（→ MARRY RICH 设计映射）

| 原作 | 我们的改造 |
| --- | --- |
| 13 关二选一 | 12 人生节点，二选一/三选一 |
| 无属性 | 三属性（能力/人脉/存款）互相牵制 |
| 无好感度 | 三隐藏好感度（导师/搭档/口碑）参与结局判定 |
| 2 结局 | 8 结局（三弧线 + 属性/好感度阈值） |
| 体力门控续玩 | 无体力；重玩钩子 = 结局收集 8/8 + 记忆碎片「如果当初」 |
| 按钮随机换位 | 保留「选项顺序稳定」，但关键节点加 **5s 限时抉择 + 人生天平倾斜**（差异化） |
| 外部音频 | WebAudio 程序化 BGM（3 场景包）+ 每事件 SFX |
