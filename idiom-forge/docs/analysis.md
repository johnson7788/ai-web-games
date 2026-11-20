# 源码分析 — 成语拼拼（Cocos Creator）→ IDIOM FORGE

> 源码目录：`/Users/admin/remake-src/成语拼拼/NewProject/`（Cocos Creator JS 工程）
> 本文件只记录**事实**（带 文件:行号），是「玩法 1:1 还原 + 全原创」改造的输入。

## 1. 入口与场景流转

- `assets/src/scene/game/GameScene.js:30` `onLoad`：挂全局 `$`（Utils）、`api`、`DeadType`、`EventType`、`new GameInfo()`。
- `GameScene.js:24` `start`：订阅 `$.events.GAME_OVER` → `showGameOver()`。
- `GameScene.js:48` `startGame`：隐藏开始屏 → 显示 `competitionView` → 隐藏结算。
- `GameScene.js:55` `showGameOver`：只切三屏可见性（开始/竞赛/结算）。
- 主循环与固定帧率：`GameScene.js:30` 注释 `cc.game.setFrameRate(60)`（原被注释）。

## 2. 核心玩法（原作为「四字排序拼成语」）

- `views/Competition.js:53` `setWords`：`levelInfo.getWords()` 取一个四字成语，`getRandomIndexList` 随机选 4 个按钮位，`outButtonList.show(idxList[i], word[i])` 把四个字随机摆到 4 个候选位。
- `Competition.js:115` `getRandomIndexList`：递归随机生成 4 个不重复下标。
- `Competition.js:72` `initTouch`：TOUCH_START/MOVE 依次把触到的候选字 `push` 进 `_links`（`this._links.indexOf(idx) == -1` 判重），`touchTo` 连线；`_links.length == 4` 时 TOUCH_END 触发 `chkComplete`。
- `Competition.js:131` `chkComplete`：`outButtonList.getWords(_links)` 按点选顺序拼出 4 字串 → `levelInfo.chkWin(word)` 判定。
- `Competition.js:156` `testIdx`：命中判定距离 `75*75`（`Competition.js:37` `_distanceSQ`）。
- 结论：原核心动词是「按正确顺序拖连 4 个候选字拼成语」。

## 3. 判定与计分（LevelInfo / WaveInfo）

- `data/WaveInfo.js:17` `isRight(word)`：`this.word == word`，逐字全等。
- `data/LevelInfo.js:83` `chkWin`：`currentTime = (now - lastWaveTime)/1000`，写入 `historyList`；答对 `score += 1`，若 `lastRight`（连对）再 `score += 1`；`setScore` 发 `SCORE_UPDATE` 事件；返回 `right`。
- `LevelInfo.js:19` `countTime = 10`（倒计时初值），`LevelInfo.js:18` `addCountWhenWin = 3`（答对加 3 秒）。
- `LevelInfo.js:37` `maxWaveCount = gameInfo.getWordsMaxCount()`（= 词库总量，见下）。

## 4. 关卡（LevelInfo 波次）

- `data/LevelInfo.js:50` `createWave`：`previewList` 优先，否则随机 `levelWordIndexList` 取一题，`levelWordIndexList.splice(idx,1)` 去重（同局不重复出题）。
- `data/LevelInfo.js:62` `getWords`：当前题为空则先 `createWave()`。
- 关卡「词库尽」死亡：`data/DeadType.js:2` `END_WORD = 2`（词库尽）；`DeadType.js:1` `TIME_UP = 1`（时间到）。

## 5. 词库

- `data/GameInfo.js:84` 起 `wordlist = [...]`：内嵌约 800+ 条四字成语（无释义）。
- `data/GameInfo.js:71` `getWordByIdx(idx)`、`GameInfo.js:74` `getWordsMaxCount()`（返回 `wordlist.length`）。
- 另有 `assets/data/words.txt`：约 3000 条短语（多数非严格成语）。

## 6. 计时器

- `core/views/CountDownView.js:27` `reset(maxCount)`：`_maxCount = maxCount`、`_isCounting = maxCount > 0`。
- `CountDownView.js:32` `addCount(count)`：`_currentCount` 加值后 clamp 到 `[0, _maxCount]`。
- `CountDownView.js:36` `update(dt)`：`_currentCount -= dt`；`_sprite.fillRange = clamp(current/max)`；`_currentCount < 0` → `$.gameInfo.dead($.deadType.TIME_UP)`。
- 另一套 `core/views/CountDownLabel.js:50` `countend`：整秒递减，`< 0` 时 `dead(TIME_UP)`。

## 7. 事件

- `core/events/EventType.js:1` 只两个事件：`GAME_OVER`、`SCORE_UPDATE`。

## 8. 存档 / 分享

- `data/GameInfo.js:33` `getBestScore`：`$.getItem(getCurrentKey())` 异步读，缺省 0。
- `GameInfo.js:49` `getCurrentKey`：`SCORE_KEY + LevelType`（`SCORE_KEY = "levelScore"`，见 `GameInfo.js:79`）。
- `GameInfo.js:52` `setBestScore(score, force)`：`score >= _bestScore` 才写，写本地 + `api.setUserData`。
- `GameScene.js:61` `resetScore`：连点 10 次强制清零分数（`resetCount = 10`）。
- `GameScene.js:73` `share`：`api.share()`。

## 9. 我方的还原映射（spec 为准，非照抄原排序玩法）

spec 的 P0 明确为「缺字填空」而非原作「排序拼成语」：

| 原作 | IDIOM FORGE 映射 |
| --- | --- |
| 4 字成语 + 4 候选位排序 | 出示成语 + 释义，缺 1–2 字，候选字格点选填空 |
| `chkWin` 连对 +1 分 | 连击计分（连对额外分） |
| `countTime=10 / addCountWhenWin=3` | 关卡计时 + 答对加 3s / 答错扣 2s |
| `LevelInfo` 波次去重 | 12 关推进，同关不重复出题 |
| 词库 `wordlist` | 内置 ≥200 成语（带释义）+ ≥150 英文词（带释义） |
| 无道具 | 提示（亮出正确字）/ 重置（换题）限量道具 |

原创改造（spec 区别点）：成语熔炉（每 5 题铸 1 件神兵 ×12）、字谜双轨（30% 概率谜面猜字 ×2）、错字回炉（3 炉渣熔炼成 1 提示）、三场景包（铁匠铺/书院/天工阁）、英/中双语各自完整可玩。
