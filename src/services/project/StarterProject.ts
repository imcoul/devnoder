import { bufferManager } from '../editor/BufferManager';
import { writeFile } from '../git/GitService';
import { projectService } from './ProjectService';

export const STARTER_PROJECT_FILES = {
  'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My first DevNoder project</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main class="shell">
      <p class="eyebrow">Built in DevNoder</p>
      <h1>Build something useful.</h1>
      <p class="lede">A small, editable HTML project that runs in your browser.</p>
      <button id="try-it" type="button">Try the interaction</button>
      <p id="message" role="status">Your project is ready to edit.</p>
    </main>
    <script src="app.js"></script>
  </body>
</html>`,
  'style.css': `:root {
  color-scheme: dark;
  font-family: Instrument Sans, system-ui, sans-serif;
  background: #0d1f1e;
  color: #f0f6fc;
}

* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0d1f1e; }
.shell { width: min(42rem, calc(100% - 2rem)); padding: 3rem; border: 1px solid #2a3f3d; border-radius: 1rem; background: #162a28; }
.eyebrow { color: #40e0d0; text-transform: uppercase; letter-spacing: .12em; font-size: .75rem; font-weight: 700; }
h1 { margin: .5rem 0; font-size: clamp(2rem, 8vw, 4rem); line-height: 1; }
.lede, #message { color: #b8cfcc; line-height: 1.6; }
button { min-height: 2.75rem; padding: .7rem 1rem; border: 0; border-radius: .5rem; background: #ffff80; color: #0d1f1e; font: inherit; font-weight: 700; cursor: pointer; }
button:hover { filter: brightness(.95); }`,
  'app.js': `const button = document.querySelector('#try-it');
const message = document.querySelector('#message');
let clicks = 0;

button?.addEventListener('click', () => {
  clicks += 1;
  message.textContent = \`You changed this project \${clicks} time\${clicks === 1 ? '' : 's'} — keep going.\`;
});`,
} as const;

/**
 * Create the recommended no-build starter in the active browser-local Git repo.
 * Keeping this separate from TemplateService makes the first useful journey
 * deterministic and lets template catalog work evolve independently.
 */
export async function createStarterProject(name: string) {
  const project = await projectService.createProject(name.trim());
  for (const [path, content] of Object.entries(STARTER_PROJECT_FILES)) {
    await writeFile(path, content);
  }
  bufferManager.open('index.html', STARTER_PROJECT_FILES['index.html'], 'html');
  return project;
}
