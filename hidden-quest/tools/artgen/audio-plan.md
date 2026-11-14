# hidden-quest 音频素材计划

> 状态：仅规划，生成稍后统一执行。现有 `src/audio.js` 为程序化 WebAudio（首次交互解锁，无外部文件）。
> 本计划只替换/增强音色素材，**不改动 `audio.*` 接口与静音逻辑**。

## BGM

| 项 | 规格 |
| --- | --- |
| 曲风 | 轻悬疑探索（cozy mystery exploration / storybook nocturne） |
| BPM | 96 |
| 调式 | E minor（偶用升高六级色彩音制造「发现感」，不阴森） |
| 情绪 | 好奇、安静、微微俏皮，像深夜阁楼里打着灯笼寻宝 |
| 编制 | 拨弦弦乐 pizzicato 动机 + 音乐盒主旋律 + 软 marimba 点缀 + upright bass 轻拨 + brushed shaker，留白多、动态小 |
| 循环 | 16 小节无缝循环（约 40s），动机首尾呼应，可长期低音量播放不烦 |
| 交付 | `assets/audio/bgm.ogg`（另备 m4a 回退），-18 LUFS 左右（寻物需要安静），循环点采样级对齐 |

## 关键音效（映射现有 src/audio.js 方法名）

| 方法 | 现状 | 目标质感 | 时长 |
| --- | --- | --- | --- |
| `audio.click()` | 660Hz square 短音 | 指腹轻点木桌的柔和 tick，极低音量 | ~50ms |
| `audio.find()` | 660→880Hz sine 双音 | 发现宝藏的魔法叮铃：上行双音钟琴 + 细碎星光沙沙尾音，惊喜但克制 | ~180ms |
| `audio.wrong()` | 180Hz sawtooth | 软木「噗」一声轻错提示，短促温和，不吓人不刺耳 | ~130ms |
| `audio.hint()` | 880→1175Hz triangle | 灯笼一闪的微光颤音：高频三角波双音 + 轻微风铃泛音 | ~160ms |
| `audio.clear()` | 523/659/784/1047Hz 四连 | 过关音乐盒 flourish：上行四音琶音 + 一枚柔和铃声收尾，温暖成就感 | ~550ms |

## 接口与静音约束

- 保留 `audio.unlock()`（首次交互解锁 AudioContext）、`audio.setMuted(m)`、`audio.muted` getter 及全部现有方法名与调用点。
- 静音时 BGM 与所有音效必须完全无声；取消静音后 BGM 从当前循环位置恢复。
- 素材缺失或加载失败时回退到现有程序化 tone 合成，游戏不报错。
- 音效文件建议放 `assets/audio/sfx/<method>.ogg`，由 audio 层内部解码为 AudioBuffer，调用签名不变。