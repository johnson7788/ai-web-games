# ludo-party 音频素材计划

> 状态：仅规划，生成稍后统一执行。现有 `src/audio.js` 为程序化 WebAudio（首次交互解锁，无外部文件）。
> 本计划只替换/增强音色素材，**不改动 `audio.*` 接口与静音逻辑**。

## BGM

| 项 | 规格 |
| --- | --- |
| 曲风 | 派对棋盘（playful board-game party / light swing） |
| BPM | 112 |
| 调式 | F major（奶油般明亮，中段可短暂转关系小调制造「被吃子」的俏皮紧张） |
| 情绪 | 欢快、热闹、合家欢，像客厅里的飞行棋之夜 |
| 编制 | marimba 主旋律 + ukulele 轻扫弦 + pizzicato bass + 轻 swing ride 与手拍 + glockenspiel 点缀；音量留白，思考回合不吵 |
| 循环 | 16 小节无缝循环（约 34s），A-A-B-A 结构，B 段稍加花 |
| 交付 | `assets/audio/bgm.ogg`（另备 m4a 回退），-15 LUFS 左右，循环点采样级对齐 |

## 关键音效（映射现有 src/audio.js 方法名）

| 方法 | 现状 | 目标质感 | 时长 |
| --- | --- | --- | --- |
| `audio.click()` | 660Hz square 短音 | 木质棋子轻点桌面的柔和 tick | ~50ms |
| `audio.roll()` | noise + 300Hz square | 骰子在木杯里摇晃翻滚：颗粒噪声 + 两三声象牙碰撞「咔啦」，收尾一声落桌闷响 | ~250ms |
| `audio.move()` | 440Hz triangle | 飞机棋子跳格的轻快「嗒」，木质 hop 声，可随步数连续播放不累 | ~70ms |
| `audio.capture()` | 200→150Hz sawtooth 下行 | 吃子滑稽音：短促「啵」+ 下滑口哨质感，俏皮不凶 | ~220ms |
| `audio.finish()` | 660→880Hz sine 双音 | 棋子抵达终点的温暖双音钟琴 + 轻铃尾音 | ~180ms |
| `audio.win()` | 523/659/784/1047Hz 四连 | 派对胜利 fanfare：上行四音木琴 + 彩带炮「砰」+ 一声欢呼气声 | ~700ms |

## 接口与静音约束

- 保留 `audio.unlock()`（首次交互解锁 AudioContext）、`audio.setMuted(m)`、`audio.muted` getter 及全部现有方法名与调用点。
- 静音时 BGM 与所有音效必须完全无声；取消静音后 BGM 从当前循环位置恢复。
- 素材缺失或加载失败时回退到现有程序化 tone/noise 合成，游戏不报错。
- 音效文件建议放 `assets/audio/sfx/<method>.ogg`，由 audio 层内部解码为 AudioBuffer，调用签名不变。