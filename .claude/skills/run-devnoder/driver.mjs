// REPL driver for DevNoder web IDE (Vite dev server). Headless Chromium via Playwright.
// Designed for agents: wrap in tmux, send-keys commands, capture-pane output.
//
// chromium-cli is not installed in this container, so this adapts the /run skill's
// Electron driver skeleton to plain Playwright `chromium` (see Gotchas in SKILL.md
// for why `playwright` is imported by absolute path instead of a bare specifier).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

let browser = null;
let page = null;

const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium';

const COMMANDS = {
  async launch() {
    if (browser) return console.log('already launched');
    const opts = { args: ['--no-sandbox'] };
    if (fs.existsSync(CHROMIUM_PATH)) opts.executablePath = CHROMIUM_PATH;
    browser = await chromium.launch(opts);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });
    page.on('pageerror', err => console.log('[pageerror]', err.message));
    page.on('requestfailed', req => console.log('[requestfailed]', req.url(), req.failure()?.errorText));
    page.on('response', res => { if (res.status() >= 400) console.log('[http', res.status() + ']', res.url()); });
    console.log('launched.');
  },

  async nav(url) {
    if (!page) return console.log('ERROR: launch first');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    console.log('nav ->', url);
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f });
    console.log('screenshot:', f);
  },

  // Click via evaluate() + DOM .click(), not locator.click() - avoids coordinate
  // math entirely. IMPORTANT: pass the raw CSS selector with NO shell quoting -
  // tmux send-keys writes literal keystrokes into this REPL's stdin, there is no
  // shell in between to strip quotes, so `click 'a.b'` sends the quote characters
  // themselves into querySelector() and breaks. Just: click a.b
  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(s => {
      const el = document.querySelector(s);
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK';
    }, sel);
    console.log('click', sel, '->', r);
  },

  async 'click-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    const r = await page.evaluate(t => {
      const els = [...document.querySelectorAll('button, a, [role="button"]')];
      const el = els.find(e => e.textContent?.trim() === t)
              ?? els.find(e => e.textContent?.includes(t));
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK: ' + el.tagName;
    }, text);
    console.log('click-text', JSON.stringify(text), '->', r);
  },

  async type(text)  { if (page) await page.keyboard.type(text, { delay: 30 }); console.log('typed:', text); },
  async press(key)  { if (page) await page.keyboard.press(key); console.log('pressed:', key); },

  // Atomic type-then-submit. Sending `type <text>` and a separate `press Enter`
  // as two tmux send-keys races: Enter can fire before keyboard.type() finishes,
  // clipping the last character(s) into the next prompt. `enter` awaits the full
  // type before pressing Enter, so it always submits the whole string.
  async enter(text) {
    if (!page) return console.log('ERROR: launch first');
    await page.keyboard.type(text, { delay: 30 });
    await page.keyboard.press('Enter');
    console.log('entered:', text);
  },

  async wait(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.waitForSelector(sel, { timeout: 10_000 }); console.log('found:', sel); }
    catch { console.log('TIMEOUT:', sel); }
  },

  async 'wait-text'(text) {
    if (!page) return console.log('ERROR: launch first');
    try {
      await page.waitForFunction(t => document.body.innerText.includes(t), text, { timeout: 10_000 });
      console.log('found text:', text);
    } catch { console.log('TIMEOUT waiting for text:', text); }
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: launch first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate(
      s => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
      sel || null));
  },

  async quit() { if (browser) await browser.close().catch(()=>{}); browser = null; page = null; console.log('quit.'); },
  help() { console.log('commands:', Object.keys(COMMANDS).join(', ')); },
};

// Read stdin from the raw fd so tmux send-keys reaches this REPL cleanly.
const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

rl.on('line', async line => {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (!cmd) return rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) { console.log('unknown:', cmd, ' - try: help'); return rl.prompt(); }
  try { await fn(rest.join(' ')); } catch (e) { console.log('ERROR:', e.message); }
  if (cmd === 'quit') { rl.close(); process.exit(0); }
  rl.prompt();
});
rl.on('close', async () => { await COMMANDS.quit(); process.exit(0); });

console.log('DevNoder driver - "help" for commands, "launch" to start');
rl.prompt();
