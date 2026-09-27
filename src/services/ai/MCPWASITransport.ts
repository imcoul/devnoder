// MCPWASITransport.ts — WASI stdio transport for MCP servers (Sprint 2 stub).
//
// A full implementation requires a WASI runtime with Node.js polyfills
// (e.g. wasmedge-quickjs). This stub documents the interface and falls
// back to the WebSocket bridge so stdio servers remain usable in the browser.
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

type MCPMessage = Record<string, unknown>;

export class WASITransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;

  constructor(private command: string, private args: string[] = []) {}

  async start(): Promise<void> {
    // TODO (Sprint 2+): spawn the command in a QuickJS/WASI context and
    // bridge stdin/stdout to the MCP SDK's Transport interface.
    // See: https://github.com/second-state/wasmedge-quickjs
    this.onerror?.(new Error('WASI stdio transport is not yet implemented. Configure this server as a WebSocket server or run it via the Termux WS bridge.'));
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  async send(_message: MCPMessage): Promise<void> {
    // no-op until start() is fully implemented
  }
}