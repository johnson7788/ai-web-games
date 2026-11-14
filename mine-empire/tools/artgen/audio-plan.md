# mine-empire 音频素材计划

> 状态：仅规划，GPU/生成稍后统一执行。现有 `src/audio.js` 为程序化 WebAudio（首次交互解锁，无外部文件）。
> 本计划只替换/增强音色素材，**不改动 `audio.*` 接口与静音逻辑**。

## BGM

| 项 | 规格 |
| --- | --- |
| 曲风 | 暖工业放置（warm industrial idle / ambient folktronica） |
| BPM | 82 |
| 调式 | D Dorian（暖调小调色彩，避免阴冷） |
| 情绪 | 温暖、勤恳、略带机械节奏的安心感，适合长时间挂机 |
| 编制 | 暖 analog pad 铺底 + 闷音 kalimba 旋律 + 低频 sine bass + 轻柔 brushed 鼓组 + 偶发的低音量金属敲击（砧声/镐声质感，音量压到点缀级） |
| 循环 | 16 小节无缝循环（约 47s），首尾和声与打击乐对齐，留 0 淡入淡出由引擎处理 |
| 交付 | `assets/audio/bgm.ogg`（另备 m4a 回退），-16 LUFS 左右，循环点采样级对齐 |

## 关键音效（映射现有 src/audio.js 方法名）

| 方法 | 现状 | 目标质感 | 时长 |
| --- | --- | --- | --- |
| `audio.click()` | 660Hz square 短音 | 干燥木柄轻敲声，极短 attack，低音量 UI tick | ~50ms |
| `audio.dig()` | noise + 180-220Hz sine | 镐头咬进泥土的沙沙噪声 + 低频闷响，尾部少量碎土颗粒声；每次播放随机 ±10% 音高避免重复感 | ~80ms |
| `audio.buy()` | 523→784Hz triangle 双音 | 温暖双音金币叮当（三角波质感保留），尾部加一枚轻微金属泛音，购买满足感 | ~160ms |
| `audio.deny()` | 160Hz sawtooth | 低沉木鱼式「咚」闷响，短促不刺耳，明确否定但不惩罚 | ~110ms |
| `audio.layer()` | 523/659/784Hz 上行三连 | 矿层突破小号角：上行钟琴琶音 + 柔和铃铛泛音 + 一缕暖风声，里程碑仪式感 | ~400ms |

## 接口与静音约束

- 保留 `audio.unlock()`（首次交互解锁 AudioContext）、`audio.setMuted(m)`、`audio.muted` getter 及全部现有方法名与调用点。
- 静音时 BGM 与所有音效必须完全无声；取消静音后 BGM 从当前循环位置恢复。
- 素材缺失或加载失败时回退到现有程序化 tone/noise 合成，游戏不报错。
- 音效文件建议放 `assets/audio/sfx/<method>.ogg`，由 audio 层内部解码为 AudioBuffer，调用签名不变。