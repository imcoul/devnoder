---
name: run-devnoder
description: Build, run, and drive the DevNoder web IDE (Vite/React PWA). Use when asked to start devnoder, run its dev server, take a screenshot of its UI, or interact with the running app (click tabs, type in the WASM terminal, etc).
---

DevNoder is a Vite + React PWA (mobile-first browser IDE). There is no
`chromium-cli` in this container, so it's driven via a small Playwright
REPL committed at `.claude/skills/run-devnoder/driver.mjs`, wrapped in
tmux so an agent can `send-keys` commands and `capture-pane` the result.

All paths below are relative to `devnoder/` (this repo's root).

## Prerequisites

Nothing to install — this container already has everything needed:
`node` (v22), Playwright (`playwright@1.56.1`, global install), and a
pre-fetched Chromium at `/opt/pw-browsers/chromium`.

## Setup

```bash
npm install
```

## Build

Not needed to run the dev server. (`npm run build` — the production
Vite build — is a separate concern; see the DevNoder Vite 8 lessons
page for its own known blocker, unrelated to running the app.)

## Run (agent path)

**1. Start the dev server, wait for it to actually serve:**

```bash
nohup npm run dev > /tmp/devnoder-dev.log 2>&1 &
disown
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null 2>&1; do sleep 1; done'
```

Default Vite port is `5173` (no `server.port` override in `vite.config.ts`).
Stop it by port, not `$!` — npm's wrapper doesn't forward `SIGTERM` to
the real Vite process:

```bash
lsof -ti:5173 -sTCP:LISTEN | xargs -r kill
```

**2. Launch the driver under tmux:**

```bash
tmux new-session -d -s devnoder -x 200 -y 50
tmux send-keys -t devnoder 'SCREENSHOT_DIR=/tmp/shots node .claude/skills/run-devnoder/driver.mjs' Enter
timeout 20 bash -c 'until tmux capture-pane -t devnoder -p | grep -q "driver>"; do sleep 0.5; done'
```

**3. Drive it.** Poll by diffing the pane against a snapshot taken
*before* sending the command, not a bare `grep` on `capture-pane` —
see Gotchas for why:

```bash
tmux capture-pane -t devnoder -p > /tmp/before.txt
tmux send-keys -t devnoder 'launch' Enter
timeout 20 bash -c 'until tmux capture-pane -t devnoder -p | diff /tmp/before.txt - | grep -q "launched\."; do sleep 0.5; done'

tmux send-keys -t devnoder 'nav http://localhost:5173' Enter
sleep 2
tmux send-keys -t devnoder 'wait #root' Enter
sleep 1
tmux send-keys -t devnoder 'ss landing' Enter
sleep 1
tmux capture-pane -t devnoder -p | tail -20
```

Then actually open `/tmp/shots/landing.png`.

One representative interaction — open the Terminal tab and run a
built-in command through the WASM shell:

```bash
tmux send-keys -t devnoder 'click-text Terminal' Enter
sleep 2
tmux send-keys -t devnoder 'click input.terminal-input' Enter
sleep 1
tmux send-keys -t devnoder 'enter help' Enter
sleep 2
tmux send-keys -t devnoder 'ss terminal-help' Enter
```

Screenshots land in `/tmp/shots/` (override with `SCREENSHOT_DIR`).

### Driver commands

| command | what it does |
|---|---|
| `launch` | launch headless Chromium, wire console/request/response error logging |
| `nav <url>` | navigate to a URL |
| `ss [name]` | screenshot -> `/tmp/shots/<name>.png` |
| `click <css-sel>` | click element via DOM `.click()` — **no shell quoting**, see Gotchas |
| `click-text <text>` | click the first `button`/`a`/`[role=button]` matching visible text |
| `type <text>` | keyboard-type text into whatever's focused |
| `press <key>` | press a single key (e.g. `Enter`) |
| `enter <text>` | type text then press Enter **atomically** — use this over `type` + `press Enter` |
| `wait <css-sel>` | wait up to 10s for a selector |
| `wait-text <text>` | wait up to 10s for text to appear in `body.innerText` |
| `eval <js>` | `page.evaluate(js)`, prints JSON |
| `text [css-sel]` | print `innerText` of a selector (or `body`) |
| `quit` | close the browser, exit the REPL |

## Run (human path)

```bash
npm run dev   # opens on http://localhost:5173, useless headless. Ctrl-C to stop.
```

## Gotchas

- **`playwright` needs an absolute-path ESM import, not the bare
  specifier.** `NODE_PATH` does not affect ESM `import` resolution the
  way it affects CommonJS `require`. The driver imports it as
  `/opt/node22/lib/node_modules/playwright/index.mjs` directly —
  confirmed that's the real entry point via `playwright`'s own
  `package.json` `exports.".".import` field.
- **No `chromium-cli` in this container.** Chromium itself IS
  pre-installed at `/opt/pw-browsers/chromium` (a symlink into
  `chromium-1194/chrome-linux/chrome`) — the driver passes that as
  `executablePath` so Playwright doesn't try to download a browser.
- **`tmux capture-pane -p` returns the whole visible screen, not just
  new output** — `tmux clear-history` only clears scrollback, not the
  currently-visible screen content. A bare `grep -q "launched\."`
  right after sending `launch` can match a **stale** `launched.` line
  still on-screen from an earlier command in the same session, and
  your poll succeeds instantly on old output. Fix: snapshot the pane
  to a file *before* sending the command, then `diff` the live pane
  against that snapshot and grep only the added lines
  (`diff /tmp/before.txt -`), as in the Run section above.
- **Don't shell-quote CSS selectors passed to `click`.** `tmux
  send-keys` writes literal keystrokes into this REPL's stdin — there
  is no shell in between to strip quotes. `click 'input.foo'` sends
  the literal single-quote characters into `querySelector()` and
  throws `SyntaxError: ... is not a valid selector`. Just write
  `click input.terminal-input` with no quotes at all.
- **`type` + a separate `press Enter` can race on longer strings.**
  `keyboard.type()` with a per-character delay takes real time; if you
  send `press Enter` too soon behind it, Enter fires mid-type and
  clips the tail of the string into the next prompt. Use the driver's
  `enter <text>` command instead — it awaits the full type before
  pressing Enter.
- **Two console errors are expected and are not app bugs**: Google
  Fonts (`fonts.googleapis.com`) and the Hugging Face model CDN
  (`huggingface.co/Xenova/...`) both fail with
  `net::ERR_CONNECTION_RESET` because this container has no general
  internet egress beyond the agent proxy allowlist. A WebSocket to
  `ws://localhost:7723` (the optional "Termux bridge" check) also
  fails with `ERR_CONNECTION_REFUSED` since no local bridge is
  running — DevNoder falls back gracefully in the UI when it does.
  Don't chase these.

## Troubleshooting

- **`EADDRINUSE` on port 5173**: an old dev server is still running.
  `lsof -ti:5173 -sTCP:LISTEN | xargs -r kill` before relaunching.
- **`click`/`wait` returns `NOT_FOUND` for something you can see in a
  screenshot**: the element is likely inside a shadow root or the
  selector is slightly off. Use `eval document.querySelector("input")?.outerHTML`
  to inspect the real DOM and build the selector from that, rather
  than guessing from the rendered screenshot.
