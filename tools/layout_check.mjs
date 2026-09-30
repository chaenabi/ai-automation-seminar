import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { ROOT, findChromium, serve } from "./lib.mjs";

const VIEWPORTS = [
  { name: "1920x1080", width: 1920, height: 1080, desktop: true },
  { name: "1366x768", width: 1366, height: 768, desktop: true },
  { name: "390x844", width: 390, height: 844, desktop: false },
];

// Runs inside the page. Must stay self-contained.
function analyzeActiveSlide() {
  const slide = document.querySelector(".slide.active");
  const issues = [];
  const describe = (el) => {
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    return `<${el.tagName.toLowerCase()}> "${text.slice(0, 40)}"`;
  };
  if (document.documentElement.scrollWidth > window.innerWidth + 1) issues.push({ type: "page-overflow-x" });
  if (slide.scrollWidth > slide.clientWidth + 1) issues.push({ type: "slide-overflow-x" });
  if (slide.scrollHeight > slide.clientHeight + 1) issues.push({ type: "slide-overflow-y" });

  for (const img of slide.querySelectorAll("img")) {
    if (!img.complete || img.naturalWidth === 0) issues.push({ type: "broken-image", where: img.getAttribute("src") });
  }
  const iconUrls = new Set();
  for (const el of slide.querySelectorAll(".icon")) {
    const style = getComputedStyle(el);
    const match = /url\("?(.*?)"?\)/.exec(style.maskImage || style.webkitMaskImage || "");
    if (match) iconUrls.add(match[1]);
    else issues.push({ type: "broken-icon", where: describe(el) });
  }

  const isBlock = (el) => {
    const display = getComputedStyle(el).display;
    return !display.startsWith("inline") && display !== "contents";
  };
  const blockOf = (node) => {
    let el = node.parentElement;
    while (el && el !== slide && !isBlock(el)) el = el.parentElement;
    return el;
  };
  const skipped = (el) => el.closest("aside.notes, pre, code, svg, .sources, [data-layout-ignore]");
  const WORD = /[\p{L}\p{N}]/u;
  const PUNCT = /[\p{P}\p{S}]/u;
  const seqs = new Map();
  const push = (block, item) => {
    if (!seqs.has(block)) seqs.set(block, []);
    seqs.get(block).push(item);
  };
  const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const range = document.createRange();
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === 1) {
      if (node.tagName === "BR" && !skipped(node)) {
        const block = blockOf(node);
        if (block) push(block, { sep: true });
      }
      continue;
    }
    const parent = node.parentElement;
    if (!parent || skipped(parent) || parent.getClientRects().length === 0) continue;
    const block = blockOf(node);
    if (!block) continue;
    const text = node.data;
    for (let i = 0; i < text.length; i++) {
      if (/\s/.test(text[i])) {
        push(block, { sep: true });
        continue;
      }
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      push(block, { ch: text[i], top: rect.top, h: rect.height });
    }
  }
  for (const [block, items] of seqs) {
    const lines = [];
    let line = null;
    let prev = null;
    let separated = false;
    for (const item of items) {
      if (item.sep) {
        separated = true;
        continue;
      }
      if (!line || item.top > line.top + line.h * 0.6) {
        if (line && prev && !separated && WORD.test(prev.ch) && WORD.test(item.ch)) {
          issues.push({ type: "mid-word-break", at: `${prev.ch}|${item.ch}`, where: describe(block) });
        }
        line = { top: item.top, h: item.h, chars: [] };
        lines.push(line);
      }
      line.chars.push(item.ch);
      prev = item;
      separated = false;
    }
    if (lines.length >= 2) {
      const last = lines[lines.length - 1].chars;
      if (last.filter((c) => !PUNCT.test(c)).length <= 1) {
        issues.push({ type: "orphan", at: last.join(""), where: describe(block) });
      }
    }
  }
  return { issues, iconUrls: [...iconUrls] };
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: node tools/layout_check.mjs <path.html> [...]");
  process.exit(2);
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: findChromium() });
const problems = [];
try {
  for (const target of targets) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(`${base}/${target}`, { waitUntil: "load" });
      await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
      await page.evaluate(() => document.fonts.ready);
      const count = await page.evaluate(() => document.querySelectorAll(".slide").length);
      const outDir = path.join(ROOT, "tools", "out", target.replace(/\//g, "_").replace(/\.html$/, ""), vp.name);
      fs.mkdirSync(outDir, { recursive: true });
      for (let i = 0; i < count; i++) {
        await page.evaluate((index) => {
          const slides = [...document.querySelectorAll(".slide")];
          if (window.deck) window.deck.show(index);
          else slides.forEach((s, j) => s.classList.toggle("active", j === index));
          slides[index].querySelectorAll(".fragment").forEach((f) => f.classList.add("visible"));
        }, i);
        await page.evaluate(() =>
          Promise.all(
            [...document.querySelectorAll(".slide.active img")].map((img) =>
              img.complete ? null : new Promise((resolve) => { img.onload = img.onerror = resolve; }),
            ),
          ),
        );
        const { issues, iconUrls } = await page.evaluate(analyzeActiveSlide);
        for (const url of iconUrls) {
          const res = await fetch(url);
          if (!res.ok) issues.push({ type: "broken-icon", where: url });
        }
        for (const issue of issues) {
          if (!vp.desktop && issue.type === "slide-overflow-y") continue;
          const at = issue.at ? ` ${JSON.stringify(issue.at)}` : "";
          problems.push(`${target} ${vp.name} #${i + 1} ${issue.type}${at} ${issue.where || ""}`.trim());
        }
        await page.screenshot({ path: path.join(outDir, `${String(i + 1).padStart(2, "0")}.png`) });
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
for (const p of problems) console.log(p);
console.log(problems.length ? `${problems.length} problem(s)` : "OK");
process.exit(problems.length ? 1 : 0);
