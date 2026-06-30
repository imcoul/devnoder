// WASMRuntime.ts — QuickJS + Pyodide + PHP + Ruby execution
export type Runtime = 'quickjs' | 'pyodide' | 'php' | 'ruby';

export interface RunResult { stdout: string; stderr: string; exitCode: number; }

class WASMRuntime {
  private quickjs: any = null;
  private pyodide: any = null;
  private php: any = null;

  async runJS(code: string): Promise<RunResult> {
    try {
      if (!this.quickjs) {
        const variant = (await import('@jitl/quickjs-singlefile-browser-release-sync')).default;
        const { newQuickJSWASMModuleFromVariant } = await import('quickjs-emscripten');
        this.quickjs = await newQuickJSWASMModuleFromVariant(variant);
      }
      const vm = this.quickjs.newContext();
      const logs: string[] = [];
      const logFn = vm.newFunction('log', (...args: any[]) => {
        logs.push(args.map((a: any) => vm.dump(a)).join(' '));
      });
      const console = vm.newObject();
      vm.setProp(console, 'log', logFn);
      vm.setProp(vm.global, 'console', console);
      logFn.dispose(); console.dispose();

      const result = vm.evalCode(code);
      if (result.error) {
        const err = vm.dump(result.error); result.error.dispose(); vm.dispose();
        return { stdout: logs.join('\n'), stderr: String(err), exitCode: 1 };
      }
      result.value.dispose(); vm.dispose();
      return { stdout: logs.join('\n'), stderr: '', exitCode: 0 };
    } catch (e: any) {
      return { stdout: '', stderr: e.message, exitCode: 1 };
    }
  }

  async runPython(code: string): Promise<RunResult> {
    try {
      if (!this.pyodide) {
        const { loadPyodide } = await import('pyodide' as any);
        this.pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.29.4/full/' });
      }
      const stdout: string[] = [];
      this.pyodide.setStdout({ batched: (s: string) => stdout.push(s) });
      await this.pyodide.runPythonAsync(code);
      return { stdout: stdout.join(''), stderr: '', exitCode: 0 };
    } catch (e: any) {
      return { stdout: '', stderr: e.message, exitCode: 1 };
    }
  }

  async runPHP(code: string): Promise<RunResult> {
    try {
      const { PHP } = await import('@php-wasm/universal');
      const { loadWebRuntime } = await import('@php-wasm/web');
      const php = new PHP(await loadWebRuntime('8.4'));
      php.writeFile('/tmp/run.php', `<?php ${code}`);
      const result = await php.runStream({ scriptPath: '/tmp/run.php' });
      return {
        stdout: await result.stdoutText ?? '',
        stderr: await result.stderrText ?? '',
        exitCode: await result.exitCode ?? 0,
      };
    } catch (e: any) {
      return { stdout: '', stderr: e.message, exitCode: 1 };
    }
  }

  detectRuntime(filename: string, shebang?: string): Runtime {
    if (shebang?.includes('python') || /\.py$/.test(filename)) return 'pyodide';
    if (shebang?.includes('php')    || /\.php$/.test(filename)) return 'php';
    if (shebang?.includes('ruby')   || /\.(rb)$/.test(filename)) return 'ruby';
    return 'quickjs';
  }

  async run(code: string, runtime: Runtime): Promise<RunResult> {
    switch (runtime) {
      case 'pyodide': return this.runPython(code);
      case 'php':     return this.runPHP(code);
      default:        return this.runJS(code);
    }
  }
}

export const wasmRuntime = new WASMRuntime();
