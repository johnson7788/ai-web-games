#!/usr/bin/env python3
"""第2次超级机器人大战 · 网页版 冒烟验收

用法：
    cd games/srw2-web
    python3 -m http.server 8123 --bind 127.0.0.1 &
    python3 tests/smoke.py

检查项：
1. 首屏能加载，出现开始按钮
2. 点击开始后画面非全黑（说明 ROM 真的跑起来了）
3. 暂停 / 继续 状态正确
4. 存档写入 localStorage，读档不报错
5. 攻略弹窗能读出 GB18030 中文
6. 手机 viewport 无横向溢出
7. 无 pageerror（Wake Lock 除外）

依赖：pip install playwright && playwright install chromium
"""
from __future__ import annotations

import asyncio
import json
import pathlib
import sys

from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8123/"
ART = pathlib.Path(__file__).parent / "artifacts"
ART.mkdir(exist_ok=True)


async def main() -> int:
    failures: list[str] = []
    errors: list[str] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch()

        # ---------- 桌面 ----------
        page = await browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda e: errors.append(str(e)) if "Wake Lock" not in str(e) else None)
        await page.goto(BASE, wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(ART / "01-start.png"))

        start = page.locator(".ejs_start_button")
        if await start.count() == 0:
            failures.append("没有出现开始按钮")
        else:
            await start.click()
            await page.wait_for_timeout(7000)
            await page.screenshot(path=str(ART / "02-play.png"))

            status = await page.inner_text("#statusText")
            if "运行中" not in status:
                failures.append(f"启动后状态异常: {status}")

            # 画面不是纯黑
            shot = await page.screenshot()
            if len(shot) < 20_000:
                failures.append("画面疑似全黑（截图过小）")

            # 暂停 / 继续
            await page.click("#btnPause")
            await page.wait_for_timeout(300)
            if "已暂停" not in await page.inner_text("#statusText"):
                failures.append("暂停状态没生效")
            await page.click("#btnPause")
            await page.wait_for_timeout(300)
            if "运行中" not in await page.inner_text("#statusText"):
                failures.append("继续状态没生效")

            # 存档 / 读档
            await page.locator(".slot-actions button", has_text="存").first.click()
            await page.wait_for_timeout(500)
            keys = await page.evaluate("() => Object.keys(localStorage)")
            if "srw2.slot.1" not in keys:
                failures.append("存档没有写进 localStorage")
            await page.locator(".slot-actions button", has_text="读").first.click()
            await page.wait_for_timeout(500)
            if "已读取" not in await page.inner_text("#toast"):
                failures.append("读档没有成功")

        # 攻略
        await page.click("#btnGuide")
        await page.wait_for_timeout(1200)
        count = await page.locator(".guide-item").count()
        if count == 0:
            failures.append("攻略目录为空")
        else:
            await page.locator(".guide-item").first.click()
            await page.wait_for_timeout(800)
            text = await page.inner_text("#guideArticle")
            if len(text) < 100 or "\ufffd" in text:
                failures.append(f"攻略正文读取异常（长度 {len(text)}）")
        await page.screenshot(path=str(ART / "03-guide.png"))
        await page.click("#guideClose")

        # ---------- 手机 ----------
        mobile = await browser.new_page(
            viewport={"width": 390, "height": 844},
            is_mobile=True,
            has_touch=True,
            device_scale_factor=2,
        )
        await mobile.goto(BASE, wait_until="networkidle")
        await mobile.wait_for_timeout(1800)
        overflow = await mobile.evaluate(
            "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
        )
        if overflow > 2:
            failures.append(f"手机端横向溢出 {overflow}px")
        await mobile.screenshot(path=str(ART / "04-mobile.png"), full_page=True)

        await browser.close()

    report = {"ok": not failures and not errors, "failures": failures, "pageerrors": errors}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
