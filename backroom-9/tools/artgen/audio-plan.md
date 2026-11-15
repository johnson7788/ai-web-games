# BACKROOM 9 · 音频规格

## BGM（Lead 用 B 机 minimax-music 生成，落 assets/audio/bgm.mp3）
Genre: liminal dark ambient. BPM: 50. Key: atonal. Fluorescent hum drone, distant muffled thumps, sparse dissonant pads, unsettling empty-mall atmosphere, instrumental, no vocals.
- 60s 循环，纯器乐；首次交互解锁后起播，静音掐断/恢复从当前位置，BGM/SFX 分轨音量。

## SFX（程序化 WebAudio 兜底 + 可选 AI 音频）
src/core/audio.js 暴露：unlock()/setMuted()/muted()/play(name)；
必配音效（方法名=事件名）：ui_click, ui_back, start, score, hit, fail, win, combo, pickup, countdown。
游戏特有事件音效按 src/game 事件总线补充（如 drift/boost/near_miss/arrow_hit 等）。
缺失文件回退程序化合成，峰值 ≤0.9，master 接 DynamicsCompressor。
