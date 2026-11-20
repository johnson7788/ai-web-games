# DONKEY HURDLE — Silk Road Runner

驮满陶罐的小驴沿丝绸之路自动奔跑：点击/空格小跳、长按高跳过墙、K 丢一罐换超高跳。撞一下掉一罐，罐光商队散架。三场景包（丝路晨/绿洲午/星夜）× 12 段障碍轮换，越跑越快。

- **技术栈**：零构建纯静态 + ES Module，`python3 -m http.server` 即可跑；Canvas2D 程序化美术 + WebAudio 程序化音频，零外部素材/依赖（唯一例外：站点 SDK vendored 副本，可降级）。
- **契约**：`window.__ll`（`state.phase`/`lang`/`setLang`/`start`/`pause`/`resume`/`restart`/`save`/`ui`/`debug.layout()`）；纯逻辑 sim 可测。
- **验收**：见 `docs/report.md`；全套门禁命令见 `skills/webgame-playbook/SKILL.md` G5。

玩法数值/关卡/文案全部在 `config/`，改数字不进逻辑层。
