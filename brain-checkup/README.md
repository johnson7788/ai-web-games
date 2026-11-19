# BRAIN CHECKUP

霓虹诊所里的 30 项脑力扫描。每关一个脑筋急转弯：点靶标、长按、拖拽、翻转、输入答案、掐时机。连对攒连击，无错且抢时间拿 3 星。零依赖、零素材，全部程序化 canvas / DOM / WebAudio。

## 运行

```bash
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node tools/shots.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/artifacts
node tools/audio-check.mjs
```
