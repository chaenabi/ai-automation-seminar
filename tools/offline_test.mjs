// Opens decks straight from disk (file://), the way a presenter without Wi-Fi would.
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { ROOT, findChromium } from "./lib.mjs";

const targets = ["slides.html", "seminar-02.html", "seminar-03.html"];
const browser = await chromium.launch({ executablePath: findChromium() });
let failures = 0;
try {
  for (const target of targets) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const blocked = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && /icons\/|\.svg/.test(msg.text())) blocked.push(msg.text());
    });
    await page.goto(pathToFileURL(path.join(ROOT, target)).href, { waitUntil: "load" });
    const count = await page.evaluate(() => window.deck.count);
    let icons = 0;
    for (let i = 0; i < count; i++) {
      icons += await page.evaluate((index) => {
        window.deck.show(index);
        return document.querySelectorAll(".slide.active .icon").length;
      }, i);
      await page.waitForTimeout(30);
    }
    try {
      assert.ok(icons > 0, "deck has no icons to check");
      assert.deepEqual(blocked, []);
      console.log(`ok   ${target} icons load from file:// (${icons} icon uses)`);
    } catch (error) {
      failures++;
      console.log(`FAIL ${target} icons blocked from file://\n     ${blocked[0] || error.message}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
