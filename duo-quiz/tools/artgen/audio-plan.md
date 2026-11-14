# duo-quiz 音频素材计划

> 状态：仅规划，生成稍后统一执行。现有 `src/audio.js` 为程序化 WebAudio（首次交互解锁，无外部文件）。
> 本计划只替换/增强音色素材，**不改动 `audio.*` 接口与静音逻辑**。

## BGM

| 项 | 规格 |
| --- | --- |
| 曲风 | upbeat game-show（电视问答 funk-pop） |
| BPM | 124 |
| 调式 | C major（明亮大调，结尾句可短暂借 IV 级制造悬念） |
| 情绪 | 兴奋、竞技、合家欢，倒计时阶段不加速但可叠加紧张层 |
| 编制 | 短促 brass stabs + 弹性 synth bass + 四踩 kick + handclaps + 明亮 synth bell 旋律；可选 4 小节「倒计时紧张层」（ ticking 木鱼 + 上行半音 pad），最后 3 秒由引擎淡入 |
| 循环 | 8 小节主循环（约 15.5s）无缝，另备 4 小节紧张变奏层 |
| 交付 | `assets/audio/bgm.ogg` + `assets/audio/bgm-tension.ogg`（另备 m4a），-14 LUFS 左右，循环点采样级对齐 |

## 关键音效（映射现有 src/audio.js 方法名）

| 方法 | 现状 | 目标质感 | 时长 |
| --- | --- | --- | --- |
| `audio.click()` | 660Hz square 短音 | 演播室按钮轻按 tick，干净利落 | ~50ms |
| `audio.lock()` | 440Hz triangle | 抢答锁定「咔哒」：机械开关声 + 短促电子确认音，果断感 | ~80ms |
| `audio.correct()` | 660→880Hz sine 双音 | 答对「叮咚」：明亮双音铃 + 轻微观众欢呼气声垫底，正向反馈 | ~200ms |
| `audio.wrong()` | 180Hz sawtooth | 经典游戏节目「哇哇」低音 buzzer，短促滑稽不刺耳 | ~180ms |
| `audio.win()` | 523/659/784/1047Hz 四连 | 胜利 fanfare：上行铜管四音 + 铃鼓一击 + 短促人群喝彩，冠军时刻 | ~700ms |

## 接口与静音约束

- 保留 `audio.unlock()`（首次交互解锁 AudioContext）、`audio.setMuted(m)`、`audio.muted` getter 及全部现有方法名与调用点。
- 静音时 BGM（含紧张层）与所有音效必须完全无声；取消静音后从当前循环位置恢复。
- 素材缺失或加载失败时回退到现有程序化 tone 合成，游戏不报错。
- 音效文件建议放 `assets/audio/sfx/<method>.ogg`，由 audio 层内部解码为 AudioBuffer，调用签名不变。