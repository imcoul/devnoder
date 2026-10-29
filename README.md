# DevNoder

DevNoder is a browser-local development workbench by Srvel. It is designed around a practical loop: create or import a project, edit supported web files, preview browser-runnable content, and export a backup.

Live product: <https://devnoder.srvel.net/>

## Current setup

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm test
npm run lint
npm run test:e2e
```

The browser app uses Vite, React, TypeScript, CodeMirror, browser-local storage, and self-hosted Instrument Sans, Livvic, and JetBrains Mono font assets. The public guide at <https://devnoder.srvel.net/guide/> records the supported formats and runtime boundaries.

## What is supported

- Browser-local project files and editor workflows.
- HTML, CSS, classic JavaScript, JSON, and other supported text files.
- Static preview for browser-runnable content.
- ZIP export for a recoverable project backup.
- GitHub workflows where repository access, token permissions, network access, and the app’s supported operations are available.
- Explicitly supported WebLLM and Transformers.js/ONNX model paths, plus configured provider routes where available.

## Important limits

DevNoder is not a general npm package manager, native SDK, framework compiler, or remote deployment environment. Editable does not mean runnable: projects that need package installation, a server, native binaries, private backends, or device-specific toolchains require that environment elsewhere. Local models may need downloads, memory, storage, and compatible browser runtimes. Provider models may need keys, network access, quotas, and provider approval.

Project data is local to the browser profile. Clearing site data or changing profiles can remove access to work. Export a backup before clearing storage or moving devices; the app does not promise automatic recovery of cleared browser data.

## Branch and deployment note

The current product branch is live and can deploy automatically. Do not push, publish, or alter deployment configuration from a feature branch without owner approval. The integration owner handles commits, pushes, checkpoints, and deployment. This repository’s source of truth and issue tracker are:

- Source: <https://github.com/imcoul/devnoder/tree/codex/repair-first-project>
- Issues: <https://github.com/imcoul/devnoder/issues>
- License: AGPL-3.0
