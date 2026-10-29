# DevNoder product design record

This document records the deliberate DevNoder implementation of the updated Srvel guide. It is a product decision record, not a portfolio-wide brand-policy change.

## Direction

DevNoder uses a quiet, craftsmanlike instrument/workbench identity: state is clear before action, the first useful result is visible, and local-data boundaries are explicit. The deep-teal developer canvas (`#0D1F1E`) and turquoise signature (`#40E0D0`) remain the core visual anchors. Yellow is reserved for a genuine recommended action. A lighter purple is used where a secondary accent must remain legible on dark surfaces.

## Typography and controls

Instrument Sans supplies headlines and control hierarchy. Livvic supplies explanatory body copy. JetBrains Mono remains the code face. The selected Latin and Latin-ext font subsets are self-hosted through Fontsource; Arabic keeps a system fallback and RTL direction rather than relying on external font requests. Phosphor regular outline icons replace literal emoji in product controls.

## Identity

DevNoder uses the original product mark at `/icons/devnoder-mark.png` and a plain-text `DevNoder` lockup with the editorial attribution `by Srvel`. The product mark is not a recreation of the locked Srvel company logo and the lockup does not claim to be an official Srvel wordmark asset. Canonical product, source, issues, guide, and parent-company destinations are centralized in `src/config/productIdentity.ts`.

## Interaction and content

Settings sections wrap or stack on narrow screens. AI configuration has one destination: the AI workspace. About content is reused inside Settings rather than maintained as a second copy. Public root, Guide, and About pages contain meaningful initial HTML, route-specific metadata, and only real sitemap entries.

Copy distinguishes cached browser workflows from network-dependent model/provider work. It explains browser storage backup and recovery, general npm/native-tool limits, and model/network/quota boundaries without claiming universal offline operation, guaranteed free tiers, or physical-device acceptance.

## Accessibility

Theme and language controls remain available, including Arabic RTL. Focus-visible treatment, keyboard access, reduced-motion behavior, readable dark-surface contrast, and responsive wrapping are part of the baseline rather than optional decoration.
