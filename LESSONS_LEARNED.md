# Lessons Learned

Last updated: 2026-09-26

## Debugging & TypeScript

- **Read tool / terminal rendering can silently drop or normalize suspicious characters** (e.g. a stray `>` was dropped by both `sed` and the Read tool, making a broken line look valid). When a line "looks fine" but tsc complains at it, dump `charCodeAt` per column or use the TS parser API — terminal output is not ground truth.
- **The first error in a cascade is usually the only real bug.** A stray `>` in a method signature at line 52 produced 50 bogus errors from line 52–136. Always read the *earliest* error location, not the most prominent one. If I'd read line 52 first I would have found it in seconds.
- **`tsc --noEmit src/file.ts` is unreliable when `tsconfig.json` is present.** TypeScript emits TS5112 and skips the project config. Use `tsc --noEmit -p tsconfig.json` for a real check, or run `tsc -b` (the project's build-mode compiler).
- **Isolated compile is not a substitute for project compile.** A file can parse fine in isolation but fail under the project's `tsconfig` (allowJs, paths, moduleResolution, etc.). Always validate through the project.
- **New untracked files bypass `npm run build` validation until the next build.** If you write a file and don't re-run the build before claiming "build passed," the claim is false. The build gate here is `tsc -b && vite build`, which does typecheck — but only for files that exist when it runs.

## Validation Gates

- **Run the actual build command after every new/changed source file.** The build command is the source of truth. `npm run build` here = `tsc -b && vite build`. Tests are `npm test -- --run`. Both must pass before claiming done.
- **`tsconfig.tsbuildinfo` is a build artifact and must not be tracked in git.** It is currently tracked and gets modified by every build. Untrack it via `.gitignore` and remove it from the index.

## Branch & Commit Hygiene

- **Commit before switching context or running a risky experiment.** If a fix goes wrong, `git checkout --` is cheap only if the working tree is clean.
- **Create milestone tags before starting the next sprint.** Sprint 0/Sprint 1 tags (`m1-testable`, `m2-sandbox-adopted`) made it easy to anchor progress. Keep doing this.

## Agent / AI-specific

- **A single malformed token in a method signature cascades into dozens of "unexpected identifier" errors downstream.** When tsc output looks like garbage, grep for the first error location, dump the line at char-level, and compare with a known-good adjacent method.
- **When two tools disagree about file contents, trust the one that reads raw bytes** (`node fs.readFileSync` + `charCodeAt`) over rendered line output (`sed`, `cat`, Read tool). Rendering layers can normalize or drop bytes.
- **The TS parser API is cheap and decisive.** A 15-line Node script (`ts.createSourceFile` + `getLineAndCharacterOfPosition`) eliminates all ambiguity about what the compiler actually sees.
