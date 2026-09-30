import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { findChromium, serve } from "./lib.mjs";

const server = await serve();
const url = `http://127.0.0.1:${server.address().port}/tools/fixtures/engine.html`;
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const state = () =>
  page.evaluate(() => ({
    current: window.deck.current,
    counter: document.querySelector(".counter").textContent,
    visible: document.querySelectorAll(".slide.active .fragment.visible").length,
    dots: document.querySelectorAll(".frag-dots i.done").length,
    notesOpen: document.body.classList.contains("notes-open"),
    sidebarOpen: document.body.classList.contains("sidebar-open"),
    notes: document.querySelector(".notes-panel").textContent.trim(),
    hash: location.hash,
  }));
const imeKey = (key, code) =>
  page.evaluate(([k, c]) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k, code: c, bubbles: true })), [key, code]);
const open = async (hash = "") => {
  await page.goto(`${url}${hash}`);
  await page.reload();
};

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures++;
    console.log(`FAIL ${name}\n     ${error.message.split("\n")[0]}`);
  }
}

try {
  await open();
  await test("builds sidebar from data-title and deck title", async () => {
    const labels = await page.$$eval(".nav-item span:last-child", (els) => els.map((e) => e.textContent));
    assert.deepEqual(labels, ["첫 장", "두 번째 장", "세 번째 장"]);
    assert.equal(await page.textContent(".sidebar-head strong"), "엔진 테스트");
  });
  await test("starts on slide 1", async () => {
    const s = await state();
    assert.equal(s.current, 0);
    assert.equal(s.counter, "1 / 3");
  });
  await test("ArrowRight moves to slide 2 with fragments hidden", async () => {
    await page.keyboard.press("ArrowRight");
    const s = await state();
    assert.equal(s.current, 1);
    assert.equal(s.visible, 0);
    assert.equal(s.hash, "#slide-2");
  });
  await test("next reveals one fragment and fills one dot", async () => {
    await page.keyboard.press("ArrowRight");
    const s = await state();
    assert.equal(s.current, 1);
    assert.equal(s.visible, 1);
    assert.equal(s.dots, 1);
  });
  await test("ArrowLeft hides the last fragment", async () => {
    await page.keyboard.press("ArrowLeft");
    assert.equal((await state()).visible, 0);
  });
  await test("N opens the notes panel with the current slide notes", async () => {
    await page.keyboard.press("n");
    const s = await state();
    assert.equal(s.notesOpen, true);
    assert.match(s.notes, /두 번째 장 노트/);
  });
  await test("N works with Korean IME on (key ㅜ, code KeyN)", async () => {
    await imeKey("ㅜ", "KeyN");
    assert.equal((await state()).notesOpen, false);
    await imeKey("ㅜ", "KeyN");
    assert.equal((await state()).notesOpen, true);
  });
  await test("M works with Korean IME on and sidebar jump refreshes notes", async () => {
    await imeKey("ㅡ", "KeyM");
    assert.equal((await state()).sidebarOpen, true);
    await page.click(".nav-item >> nth=2");
    const s = await state();
    assert.equal(s.current, 2);
    assert.equal(s.sidebarOpen, false);
    assert.match(s.notes, /노트 없음/);
  });
  await test("aside.notes is never shown on the slide", async () => {
    const display = await page.$eval("section.slide aside.notes", (el) => getComputedStyle(el).display);
    assert.equal(display, "none");
  });
  await test("Space right after clicking the next button advances one step", async () => {
    await open("#slide-1");
    await page.click('[data-action="next"]');
    assert.equal((await state()).current, 1);
    await page.keyboard.press(" ");
    const s = await state();
    assert.equal(s.current, 1);
    assert.equal(s.visible, 1);
  });
  await test("out-of-range hash opens the last slide", async () => {
    await open("#slide-99");
    assert.equal((await state()).current, 2);
  });
  await test("flow node text stays dark on dark slides", async () => {
    const color = await page.$eval(".slide.dark .node", (el) => getComputedStyle(el).color);
    assert.equal(color, "rgb(24, 32, 40)");
  });
} finally {
  await browser.close();
  server.close();
}
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
