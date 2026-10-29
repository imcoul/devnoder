// TerminalSession.ts — browser-safe commands over local WASM runtimes.
// Remote commands are used only if the Worker explicitly advertises that capability.
import { cloudExecutor } from './CloudExecutor';
import { wasmRuntime } from './WASMRuntime';
import { termuxBridge } from './TermuxBridge';
import { getDir, normalizeProjectPath, readFile } from '../git/GitService';

export type OutputLine = { type: 'stdout' | 'stderr' | 'system' | 'input'; text: string };
type OutputHandler = (line: OutputLine) => void;

export class TerminalSession {
  private handlers: OutputHandler[] = [];
  private get cwd() { return getDir(); }
  private env: Record<string, string> = { PATH: '/usr/bin:/bin', HOME: '/root', TERM: 'xterm-256color' };

  onOutput(h: OutputHandler) { this.handlers.push(h); }
  offOutput(h: OutputHandler) { this.handlers = this.handlers.filter(f => f !== h); }
  emit(line: OutputLine) { this.handlers.forEach(h => h(line)); }

  async init() {
    this.emit({ type: 'system', text: '🚀 DevNoder Terminal — Srvel Build Tools v0.1' });
    this.emit({ type: 'system', text: `Routing: local WASM${termuxBridge.available ? ' + Termux' : ''}` });
    this.emit({ type: 'system', text: "Type 'help' for available commands\n" });
  }

  async run(raw: string) {
    const input = raw.trim();
    if (!input) return;
    this.emit({ type: 'input', text: `$ ${input}` });

    const [cmd, ...args] = input.split(/\s+/);

    // Built-ins
    if (cmd === 'help') return this.help();
    if (cmd === 'clear') return this.emit({ type: 'system', text: '\x1b[2J\x1b[H' });
    if (cmd === 'pwd')   return this.emit({ type: 'stdout', text: this.cwd });
    if (cmd === 'echo')  return this.emit({ type: 'stdout', text: args.join(' ') });
    if (cmd === 'env')   return Object.entries(this.env).forEach(([k, v]) => this.emit({ type: 'stdout', text: `${k}=${v}` }));
    if (cmd === 'export') { const [k, v] = args[0]?.split('=') ?? []; if (k) this.env[k] = v ?? ''; return; }

    // The browser runtime has no Node package filesystem. Be explicit rather
    // than claiming that a CDN resolution created node_modules.
    if (cmd === 'npm' && args[0] === 'install') {
      this.emit({ type: 'stderr', text: 'npm install is not available in the browser/WASM terminal yet. No packages or files were installed.' });
      return;
    }

    // Eval inline snippets: node -e "code"
    if (cmd === 'node' && args[0] === '-e') {
      const code = args.slice(1).join(' ').replace(/^["']|["']$/g, '');
      const result = await wasmRuntime.run(code, 'quickjs');
      if (result.stdout) this.emit({ type: 'stdout', text: result.stdout });
      if (result.stderr) this.emit({ type: 'stderr', text: result.stderr });
      return;
    }

    // File commands execute the actual active-project source in WASM.
    if (cmd === 'node' && args[0]) return this.runFile(args[0], 'quickjs');
    if ((cmd === 'python' || cmd === 'python3') && args[0]) return this.runFile(args[0], 'pyodide');
    if (cmd === 'php' && args[0]) return this.runFile(args[0], 'php');

    // Forward to Termux if available
    if (termuxBridge.available) { termuxBridge.send(input); return; }

    // Cloud fallback (HTTP executor worker, no PTY)
    if (cloudExecutor.available) {
      this.emit({ type: 'system', text: `Command '${cmd}' not found in WASM; trying cloud…` });
      const res = await cloudExecutor.run(input, 'bash');
      if (res.stdout) this.emit({ type: 'stdout', text: res.stdout });
      if (res.stderr) this.emit({ type: 'stderr', text: res.stderr });
      if (res.exitCode !== 0) this.emit({ type: 'system', text: `Exit ${res.exitCode}` });
      return;
    }

    this.emit({ type: 'system', text: `Command not found: ${cmd}` });
    this.emit({ type: 'system', text: 'Tip: connect Termux for a native shell, or use a supported WASM runtime.' });
  }

  private async runFile(path: string, runtime: 'quickjs' | 'pyodide' | 'php') {
    try {
      const safePath = normalizeProjectPath(path.replace(/^\.\//, ''));
      const code = await readFile(safePath);
      this.emit({ type: 'system', text: `Running ${safePath} via ${runtime} WASM…` });
      const result = await wasmRuntime.run(code, runtime);
      if (result.stdout) this.emit({ type: 'stdout', text: result.stdout });
      if (result.stderr) this.emit({ type: 'stderr', text: result.stderr });
      this.emit({ type: 'system', text: `Process exited with code ${result.exitCode}` });
    } catch (error) {
      this.emit({ type: 'stderr', text: error instanceof Error ? error.message : String(error) });
    }
  }

  private help() {
    const lines = [
      'DevNoder Terminal — built-ins:',
      '  help              show this message',
      '  clear             clear screen',
      '  pwd               print working directory',
      '  echo <text>       print text',
      '  env               show environment',
      '  export KEY=VAL    set env variable',
      '  npm install <pkg> unsupported in browser WASM (does not modify files)',
      '  node -e "<code>"  run JS inline (QuickJS WASM)',
      '  node <file>       run JS file',
      '  python3 <file>    run Python (Pyodide)',
      '  php <file>        run PHP (WASM)',
      '',
      'Native commands forwarded to Termux if connected.',
    ];
    lines.forEach(l => this.emit({ type: 'stdout', text: l }));
  }
}

export const terminalSession = new TerminalSession();
