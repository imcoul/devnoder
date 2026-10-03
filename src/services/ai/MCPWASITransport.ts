// MCPWASITransport.ts — WASI stdio transport for MCP servers (Sprint 2 stub).
//
// A full implementation requires a WASI runtime with Node.js polyfills
// (e.g. wasmedge-quickjs or @quickjs/ffi). This stub documents the
// interface and emits a clear error so stdio servers can still be used
// by routing through a WebSocket bridge instead.
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

type MCPMessage = Record<string, unknown>;

export class WASITransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;

  constructor(private command: string, private args: string[] = []) {}

  static isSupported(): boolean {
    // TODO (Sprint 2+): return true when a WASI runtime is detected.
    // For now, always false so callers can fall back to WebSocket.
    return false;
  }

  async start(): Promise<void> {
    const reason = 'WASI stdio transport is not available in this build. '
      + 'Run your MCP server as a WebSocket server and use the WebSocket transport, '
      + 'or use the Termux WebSocket bridge to reach a stdio server.';
    this.onerror?.(new Error(reason));
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  async send(_message: MCPMessage): Promise<void> {
    // no-op until a WASI runtime is wired up
  }
}