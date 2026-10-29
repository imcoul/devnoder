# Contributing to DevNoder

Thanks for helping improve DevNoder. Keep contributions focused on a verifiable browser workflow and preserve the product’s local-data honesty.

## Before opening a change

1. Read the public guide and the relevant project plan.
2. Check the current branch and deployment status. The live product branch is a release surface; do not publish from a feature branch.
3. Keep secrets, real GitHub tokens, private project data, and generated model files out of commits.
4. Prefer the existing services and capability states over adding a new parallel storage or runtime path.

## Local checks

Run the checks that match your change:

```bash
npm ci
npm run typecheck
npm test
npm run lint
npm run test:e2e
```

Browser tests may need a local Vite server and their documented test environment. Unit tests must not depend on a live provider, a real GitHub credential, a physical device, or a model download. Mock network boundaries and use temporary browser storage where appropriate.

## Product and UI expectations

Use the existing deep-teal canvas and turquoise signature color. Reserve yellow for a genuine recommended action, keep purple legible on dark surfaces, and use the self-hosted Instrument Sans/Livvic/JetBrains Mono system. Use Phosphor outline icons rather than literal emoji in product controls. Keep layouts usable at narrow widths and preserve keyboard, reduced-motion, and RTL behavior.

State capability boundaries plainly. Do not claim that a browser workflow is fully offline, that a tier is guaranteed free, that arbitrary model formats run, or that a physical device has been tested unless there is current evidence. Protect the existing encrypted key-storage behavior and never reset user storage as a shortcut.

## Pull requests

Describe the user-visible outcome, affected files, checks run, and any remaining limitations. Include screenshots only when they clarify a visual change. Do not commit generated raw model files or change deployment, hosting, or unrelated brand policy without explicit owner approval.
