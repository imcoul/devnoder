// TermuxBridge.ts — WebSocket bridge to Termux on localhost:7723
const WS_URL = 'ws://localhost:7723';

type MessageHandler = (data: string) => void;

class TermuxBridge {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private queue: string[] = [];
  available = false;

  async connect(): Promise<boolean> {
    return new Promise(resolve => {
      try {
        const ws = new WebSocket(WS_URL);
        const timeout = setTimeout(() => { ws.close(); resolve(false); }, 2000);
        ws.onopen = () => {
          clearTimeout(timeout);
          this.ws = ws;
          this.available = true;
          this.queue.forEach(cmd => ws.send(cmd));
          this.queue = [];
          resolve(true);
        };
        ws.onmessage = e => this.handlers.forEach(h => h(String(e.data)));
        ws.onclose = () => { this.ws = null; this.available = false; };
        ws.onerror = () => { clearTimeout(timeout); resolve(false); };
      } catch { resolve(false); }
    });
  }

  send(command: string) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(command + '\n');
    else this.queue.push(command + '\n');
  }

  onMessage(handler: MessageHandler) { this.handlers.push(handler); }
  offMessage(handler: MessageHandler) { this.handlers = this.handlers.filter(h => h !== handler); }

  disconnect() { this.ws?.close(); }
}

export const termuxBridge = new TermuxBridge();
