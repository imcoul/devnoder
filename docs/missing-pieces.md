# DevNoder — current release and service gaps

**Snapshot:** 27 October 2026. The frontend is now publicly live at [devnoder.srvel.net](https://devnoder.srvel.net). Cloudflare Pages project `devnoder` builds from `codex/repair-first-project`, the repair branch the owner explicitly selected for direct production deployment. The GitHub public `main` branch was not changed; draft PR #3 against `develop` remains open and unmerged. Because that branch is the Pages production branch, future pushes to it may automatically update the live site.

## Live deployment and infrastructure

- Cloudflare Pages reports the custom domain active. The only `devnoder.srvel.net` DNS record is a proxied CNAME to `devnoder.pages.dev`.
- The live URL returns HTTP 200 with the DevNoder application title. The referenced JavaScript returns 200. The ONNX WASM asset is returned with `Content-Type: application/wasm` and `Content-Encoding: gzip`.
- The account also contains Worker scripts named `devnoder`, `devnoder-executor`, `devnoder-oauth`, and `devnoder-collab`, under the verified `ibrahimmamadoucoulibaly.workers.dev` subdomain. Script existence does not mean that product APIs work.
- The executor is not configured; `/skills`, `/execute`, and `/deploy` return HTTP 501. The browser client keeps cloud execution disabled unless the Worker advertises an explicitly configured execution capability.
- The collaboration script exists, but its checked health route returned 404; a working Durable Object/Yjs session has not been proved.
- The OAuth callback/state/scopes remain unverified. The app offers a user-provided fine-grained PAT flow instead.
- `wrangler.toml` contains a D1 ID and `devnoder-storage` R2 binding; migrations, binding, authorization and data isolation still need deployment-time verification.

## What is implemented and live-browser verified

- Project files persist through create → edit → autosave → reload → reopen; the browser flow passed on desktop Chromium and Android-profile Chromium.
- ZIP export flushes dirty buffers, preserves binary bytes, excludes `.git` and respects a 20,000-file/100 MiB cap. Production-browser tests inspected exported file contents.
- A project preview assembles a bounded static snapshot with local CSS; its iframe uses a restrictive sandbox/CSP. External requests are blocked and module graphs, binary assets and multi-page links are not claimed to work.
- The live model UI can search/select the pinned WebLLM catalog and register compatible public Hugging Face `owner/model` entries for Transformers.js ONNX text generation. A separate isolated browser against production downloaded `onnx-community/tiny-random-gpt2-ONNX`, loaded it and generated text. Its weights are intentionally random and the output was nonsense: this proves one small download/runtime path, not useful model quality or code assistance. The [model card][4] documents its Transformers.js `text-generation` use.
- GitHub origin/token UI was tested against mocked `api.github.com` responses. Fine-grained PAT storage is encrypted in the device-bound browser vault, but actual credentialed clone/push/pull and conflict behavior have not been exercised.

## Runtime and model boundaries

JavaScript/Python/PHP file commands run through named local/WASM adapters. This is not a general OS shell, native toolchain, npm package manager, Node project build system or arbitrary framework runner. The preview only supports a static subset.

“Any model” is not yet supported. Local use is limited to the pinned WebLLM registry or compatible public Transformers.js ONNX text-generation repositories. GGUF and arbitrary model formats are unsupported. The tiny random model smoke test does not prove a useful code model, larger-weight model, or inference on physical devices. WebGPU, browser storage eviction, offline behavior and cancellation vary by browser/device. A custom OpenAI-compatible endpoint talks to an already-running server; it does not download weights. Do not advertise model UI registration as broad model support.

## Build and checks

A clean `npm ci` and production build passed before deployment. The 26.86 MB ONNX WASM file is gzipped to 6.32 MiB with a rewritten asset URL; Cloudflare Pages serves it decompressed to the browser using a scoped response header. The build generated 86 precache entries (17,614.55 KiB) and no individual asset exceeds 25 MiB.

The unit suite passed **20 files / 135 tests** with **23.49% global line coverage**. ESLint exits 0 with **241 warnings**. The complete dependency audit reports **zero advisories**. Eight desktop/Android-profile production-browser tests passed against the live custom domain: first-project save/reload/ZIP, model catalog/HF registration, sandboxed project preview, and mocked GitHub-token persistence/disconnect. A separate isolated browser successfully downloaded and ran the tiny random ONNX model above. Android was emulated and no real GitHub credentials were used. All five PR checks (push/PR unit and E2E plus Cloudflare Pages) passed on commit `6a345c0`; verify the current head before merging.

## Remaining work before broad daily-use readiness

1. Test useful compatible models, including a coding model, on physical target devices. The tiny random-model test proves only that a small public ONNX repository can download and run. Document supported ONNX/WebLLM formats and keep GGUF outside scope until a runtime exists.
2. Configure and security-test executor/collaboration or keep those capabilities disabled; validate origin allowlists, authentication, project isolation, quotas, timeouts and cancellation before enabling remote execution.
3. Exercise real fine-grained-token Git clone/push/pull and conflict handling on an authorized test repository. Verify OAuth only if it will be offered.
4. Decide when to merge PR #3 into `develop` and later `main`. The current public Pages deployment is intentionally built from the draft repair branch, not from `main`; keep a tested rollback path.
5. Add unit coverage, test physical Android, and reduce lint warnings. Expand framework/package preview only after choosing explicit supported targets.

## External platform references

[1] [Cloudflare Pages response headers](https://developers.cloudflare.com/pages/configuration/headers/) — `_headers` rules apply to static asset responses and may set response headers.

[2] [Cloudflare content compression](https://developers.cloudflare.com/speed/optimization/content/compression/) — supported gzip encoding and WebAssembly content types.

[3] [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) — the per-file deployment cap used in the build check.

[4] [Hugging Face tiny-random-gpt2 ONNX model card](https://huggingface.co/onnx-community/tiny-random-gpt2-ONNX) — documents the Transformers.js `text-generation` pipeline used in the isolated smoke test.
