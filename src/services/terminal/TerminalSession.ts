// TerminalSession.ts — 3-tier routing: Termux → WASM → Cloud
import { termuxBridge } from './TermuxBridge';
import { wasmRuntime } from './WASMRuntime';
import { cloudExecutor } from './CloudExecutor';
import { packageCDN } from './PackageCDN';

export type OutputLine = { type: 'stdout' | 'stderr' | 'system' | 'input'; text: string };
type OutputHandler = (line: OutputLine) => void;

export class TerminalSession {
  private handlers: OutputHandler[] = [];
  private cwd = '/devnoder';
  private env: Record<string, string> = { PATH: '/usr/bin:/bin', HOME: '/root', TERM: 'xterm-256color' };

  onOutput(h: OutputHandler) { this.handlers.push(h); }
  offOutput(h: OutputHandler) { this.handlers = this.handlers.filter(f => f !== h); }
  private emit(line: OutputLine) { this.handlers.forEach(h => h(line)); }

  async init() {
    this.emit({ type: 'system', text: '🚀 DevNoder Terminal — Srvel Build Tools v0.1' });
    this.emit({ type: 'system', text: 'Routing: checking Termux bridge…' });
    const hasTermux = await termuxBridge.connect();
    if (hasTermux) {
      this.emit({ type: 'system', text: '✅ Termux connected — full native shell available' });
      termuxBridge.onMessage(data => this.emit({ type: 'stdout', text: data }));
    } else {
      this.emit({ type: 'system', text: '⚡ WASM runtime active (JS/Python/PHP)' });
    }
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

    // npm install simulation
    if (cmd === 'npm' && args[0] === 'install') {
      const pkgs = packageCDN.parseInstallArgs(args.slice(1).join(' '));
      if (!pkgs.length) { this.emit({ type: 'system', text: 'Usage: npm install <pkg>' }); return; }
      this.emit({ type: 'system', text: `Installing ${pkgs.join(', ')} via esm.sh…` });
      const imports = await packageCDN.install(pkgs, pkg => this.emit({ type: 'stdout', text: `  + ${pkg}` }));
      this.emit({ type: 'stdout', text: imports });
      this.emit({ type: 'system', text: '✅ Resolved (CDN, no actual node_modules)' });
      return;
    }

    // node / python / php execution
    if (cmd === 'node' && args[0]) return this.runFile(args[0], 'quickjs');
    if ((cmd === 'python' || cmd === 'python3') && args[0]) return this.runFile(args[0], 'pyodide');
    if (cmd === 'php' && args[0]) return this.runFile(args[0], 'php');

    // Eval inline snippets: node -e "code"
    if (cmd === 'node' && args[0] === '-e') {
      const code = args.slice(1).join(' ').replace(/^["']|["']$/g, '');
      const result = await wasmRuntime.run(code, 'quickjs');
      if (result.stdout) this.emit({ type: 'stdout', text: result.stdout });
      if (result.stderr) this.emit({ type: 'stderr', text: result.stderr });
      return;
    }

    // Forward to Termux if available
    if (termuxBridge.available) { termuxBridge.send(input); return; }

    // Cloud fallback
    this.emit({ type: 'system', text: `Command '${cmd}' not found in WASM; trying cloud…` });
    const res = await cloudExecutor.run(input, 'bash');
    if (res.stdout) this.emit({ type: 'stdout', text: res.stdout });
    if (res.stderr) this.emit({ type: 'stderr', text: res.stderr });
    if (res.exitCode !== 0) this.emit({ type: 'system', text: `Exit ${res.exitCode}` });
  }

  private async runFile(path: string, runtime: 'quickjs' | 'pyodide' | 'php') {
    this.emit({ type: 'system', text: `Running ${path} via ${runtime}…` });
    // In real use, read from lightning-fs; here we inform the user
    this.emit({ type: 'system', text: 'File execution routes through WASM. Open file in editor first.' });
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
      '  npm install <pkg> resolve package via esm.sh CDN',
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
