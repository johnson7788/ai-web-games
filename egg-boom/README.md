# EGG BOOM

滚过厨房台面的弹簧蛋，射米粒弹打碎数字面粉团；连击 ×5 换蛋黄溅射，蛋壳护甲抵一次碰撞。12 关、3 套场景包（清晨厨房 / 甜品站 / 午夜食堂），程序化 Canvas 美术 + WebAudio 合成音效，零构建纯静态。

- 按住蓄力跳，松开起跳；点按加射；自动射击当前行。
- 玩法与数值见 `config/`；纯逻辑在 `src/game/sim.js`（可 `node --test`）。
- 门禁：`node --test` + `tools/selfplay.mjs` + playbook 全套脚本（见 `docs/report.md`）。
