// PreviewService.ts — local iframe + Cloudflare Tunnel + deploy
import { cloudExecutor } from '../terminal/CloudExecutor';

export interface DeployResult { url: string; id: string; timestamp: number; }
export interface TunnelResult { url: string; port: number; active: boolean; }

const DEPLOY_HISTORY_KEY = 'devnoder-deploy-history';

export interface PreviewLog { level: 'info' | 'warn' | 'error'; message: string; timestamp: number; }

class PreviewService {
  private blobUrl: string | null = null;
  private logs: PreviewLog[] = [];
  private logListeners: Array<(log: PreviewLog) => void> = [];

  onLog(cb: (log: PreviewLog) => void) { this.logListeners.push(cb); }
  offLog(cb: (log: PreviewLog) => void) { this.logListeners = this.logListeners.filter(l => l !== cb); }
  private log(level: PreviewLog['level'], message: string) {
    const entry = { level, message, timestamp: Date.now() };
    this.logs.push(entry);
    this.logListeners.forEach(cb => cb(entry));
  }

  getLogs() { return [...this.logs]; }
  clearLogs() { this.logs = []; }

  /** Build a blob URL from the active HTML buffer for iframe preview */
  buildBlobPreview(html: string): string {
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
    const blob = new Blob([html], { type: 'text/html' });
    this.blobUrl = URL.createObjectURL(blob);
    this.log('info', 'Preview built from buffer');
    return this.blobUrl;
  }

  /** Generate a shareable QR code SVG for a URL */
  async generateQR(url: string): Promise<string> {
    try {
      const QRCode = (await import('qrcode-svg')).default;
      return new QRCode({ content: url, padding: 4, width: 200, height: 200,
        color: '#40E0D0', background: '#0D1F1E' }).svg();
    } catch {
      return `<svg viewBox="0 0 100 20" xmlns="http://www.w3.org/2000/svg"><text x="5" y="15" fill="#40E0D0" font-size="6">${url}</text></svg>`;
    }
  }

  /** Request a Cloudflare Tunnel URL via the executor worker */
  async openTunnel(port = 5173): Promise<TunnelResult> {
    this.log('info', `Requesting tunnel for port ${port}…`);
    try {
      const url = await cloudExecutor.tunnel(port);
      if (!url) throw new Error('Tunnel URL empty — is the executor worker deployed?');
      this.log('info', `Tunnel open: ${url}`);
      return { url, port, active: true };
    } catch (e: any) {
      this.log('error', e.message);
      return { url: '', port, active: false };
    }
  }

  /** Deploy dist/ to Cloudflare Pages via Worker proxy */
  async deploy(files: Record<string, string>): Promise<DeployResult> {
    this.log('info', 'Starting deployment to Cloudflare Pages…');
    try {
      const res = await fetch('https://devnoder-executor.srvel-build.workers.dev/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) throw new Error(`Deploy failed: HTTP ${res.status}`);
      const data = await res.json();
      const result: DeployResult = { url: data.url, id: data.deploymentId, timestamp: Date.now() };
      const history = this.getDeployHistory();
      history.unshift(result);
      localStorage.setItem(DEPLOY_HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
      this.log('info', `Deployed: ${result.url}`);
      return result;
    } catch (e: any) {
      this.log('error', e.message);
      throw e;
    }
  }

  getDeployHistory(): DeployResult[] {
    try { return JSON.parse(localStorage.getItem(DEPLOY_HISTORY_KEY) ?? '[]'); } catch { return []; }
  }

  cleanup() {
    if (this.blobUrl) { URL.revokeObjectURL(this.blobUrl); this.blobUrl = null; }
  }
}

export const previewService = new PreviewService();
