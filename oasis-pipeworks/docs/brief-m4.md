# Oasis Pipeworks · M4 执行单：音频（WebAudio 程序化 BGM + SFX）

> 前置：契约见 `docs/README.md` §5 音频段。事件名见 §3.5。
> 只改：`src/core/audio.js`、`tools/audio-check.mjs`。
> 禁改：其余一切文件。

## 0. 完成定义（可验收）

- `node tools/audio-check.mjs` 输出 PASS：每个 SFX 与 BGM 离屏渲染（OfflineAudioContext）RMS > 0.01、时长正确、BGM 首尾循环拼接无淡入静音。
- `src/core/audio.js` 导出 `createAudio()` → `{ event(name, payload), setMuted(b), startBgm(), stopBgm(), unlock() }`；main 用 `event()` 消费 sim 事件。

## 1. 硬约束

- 纯 WebAudio 程序化，零音频文件、零外链。
- 首次用户手势解锁（`unlock()` 幂等，挂在 pointerdown/keydown）。
- 默认不静音（muted=false 初始）。

## 2. 交付物

- `src/core/audio.js`（≤400 行，含模块头注释）：
  - **BGM**：益智轻快。BPM 112，四层编制（打击点=短噪声木鱼、贝斯=三角波根音、和弦垫=两音 sawTooth 轻 LPF、主音=马林巴感 sine+短衰减）。C 大调，进行 C–Am–F–G 每和弦 2 小节，A 段 8 小节无主音，B 段 8 小节主音进来，16 小节循环；循环无缝（相位连续，不用 media 淡入淡出）。
  - **SFX**（每个都短 ≤0.6s）：grab（木 click 2k Hz 阻尼）、place（陶土 clunk 180Hz + 噪声沙 puff）、dig（噪声爆发 + 低通扫频）、flowTick（水滴 blip，每格过水时）、bloom（风铃三连音上行）、win（五音上行 jingle C-E-G-C-E）、lose（120Hz 闷 thud + 短噪声）、countdown（最后 5s 每秒 beep 880Hz）。
  - `event(name, payload)`：switch 事件名调用对应 SFX；bloom 事件音高随 payload.blooms 递增半音（封顶 +7）。
- `tools/audio-check.mjs`：OfflineAudioContext 渲染 BGM 一个循环（≈34.3s）与全部 SFX，断言 RMS、时长、峰值；输出 `tools/fun/audio-report.json`。
- 参考：`games/screw-puzzle/src/core/audio.js` 是同类实现（可读，不可抄文案注释；API 保持一致方便 main 接线：`createAudio()/event/setMuted/startBgm/stopBgm/unlock`）。

## 3. 行为规格

- BGM 音量总线 -14dB，SFX -10dB；`setMuted(true)` 全静音（gain=0，节点不销毁）。
- win/lose 时 BGM 短暂 duck 到 -20dB 3s 再回。

## 4. 验收命令（自己跑并贴输出）

```bash
cd games/oasis-pipeworks
node tools/audio-check.mjs
```

## 5. 优先级

P0：BGM + 7 个 SFX + audio-check；P2：duck/音高递增。

## 6. 交付格式

1) 文件清单 2) audio-check 输出 3) 未做项 4) 最不满意的一处
