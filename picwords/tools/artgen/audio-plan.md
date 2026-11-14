# picwords 音频素材计划

> 状态：仅规划，生成稍后统一执行。现有 `src/audio.js` 为程序化 WebAudio（首次交互解锁，无外部文件）。
> 本计划只替换/增强音色素材，**不改动 `audio.*` 接口与静音逻辑**。

## BGM

| 项 | 规格 |
| --- | --- |
| 曲风 | 放松 puzzle（chill lo-fi puzzle / ambient picture-book） |
| BPM | 76 |
| 调式 | G major（柔和明亮，和声节奏慢，每两小节一换） |
| 情绪 | 安静、专注、治愈，像深海里慢慢拼词，无时间压力感 |
| 编制 | 软 Rhodes 和弦 +  airy pad 铺底 + glockenspiel 稀疏旋律 + 闷音 lo-fi kick 与极轻 shaker，高频圆润不刺耳 |
| 循环 | 16 小节无缝循环（约 50s），旋律留白多，可长时间低音量播放 |
| 交付 | `assets/audio/bgm.ogg`（另备 m4a 回退），-18 LUFS 左右，循环点采样级对齐 |

## 关键音效（映射现有 src/audio.js 方法名）

| 方法 | 现状 | 目标质感 | 时长 |
| --- | --- | --- | --- |
| `audio.click()` | 660Hz square 短音 | 软木轻点 tick，极低音量 | ~50ms |
| `audio.place()` | 440±rand Hz triangle | 字母块落入槽位的软「啵」声：木质 plop + 轻微树脂感，随机音高保留避免重复 | ~70ms |
| `audio.correct()` | 523/659/784Hz 三连 | 拼对单词的温暖解决和弦：上行三音钟琴，柔和满足感 | ~350ms |
| `audio.wrong()` | 180Hz sawtooth | 低沉温和的「嗯~」提示音，短促不惩罚，鼓励再试 | ~150ms |
| `audio.hint()` | 880Hz triangle | 单音微光 ping：高频三角波 + 一缕气泡泛音，提示而不泄底 | ~100ms |
| `audio.complete()` | 523/659/784/1047Hz 四连 | 全关完成 glockenspiel flourish：上行四音琶音 + 柔和铃声收尾 | ~550ms |

## 接口与静音约束

- 保留 `audio.unlock()`（首次交互解锁 AudioContext）、`audio.setMuted(m)`、`audio.muted` getter 及全部现有方法名与调用点。
- 静音时 BGM 与所有音效必须完全无声；取消静音后 BGM 从当前循环位置恢复。
- 素材缺失或加载失败时回退到现有程序化 tone 合成，游戏不报错。
- 音效文件建议放 `assets/audio/sfx/<method>.ogg`，由 audio 层内部解码为 AudioBuffer，调用签名不变。