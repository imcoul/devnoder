import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LSPClient, createLSPClient, type LSPDiagnostic } from '../editor/LSPClient';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;

  readyState = MockWebSocket.CONNECTING;
  send = vi.fn();
  close = vi.fn();
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
}

describe('LSPClient', () => {
  let client: LSPClient;

  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as any).WebSocket = MockWebSocket;
    client = createLSPClient({ rootUri: 'file:///test', languageId: 'typescript' });
  });

  it('connects to LSP server', async () => {
    const connectPromise = client.connect('ws://localhost:8765');
    setTimeout(() => {
      const ws = MockWebSocket.instances[0];
      ws.readyState = MockWebSocket.OPEN;
      if (ws.onopen) ws.onopen();
    }, 0);
    await connectPromise;
    expect(client.isConnected()).toBe(true);
  });

  it('sends initialize request on connect', async () => {
    const connectPromise = client.connect('ws://localhost:8765');
    setTimeout(() => {
      const ws = MockWebSocket.instances[0];
      ws.readyState = MockWebSocket.OPEN;
      if (ws.onopen) ws.onopen();
    }, 0);
    await connectPromise;
    const calls = MockWebSocket.instances[0].send.mock.calls;
    const initCall = calls.find((c: any[]) => JSON.parse(c[0]).method === 'initialize');
    expect(initCall).toBeDefined();
    if (!initCall) return;
    const params = JSON.parse(initCall[0]).params;
    expect(params.rootUri).toBe('file:///test');
    expect(params.capabilities).toBeDefined();
  });

  it('receives diagnostics via publishDiagnostics', async () => {
    const connectPromise = client.connect('ws://localhost:8765');
    const diagnosticsPromise = client.getDiagnostics('file:///test/index.ts');
    setTimeout(() => {
      const ws = MockWebSocket.instances[0];
      ws.readyState = MockWebSocket.OPEN;
      if (ws.onopen) ws.onopen();
    }, 0);
    await connectPromise;
    const diag: LSPDiagnostic[] = [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
        severity: 1,
        message: 'Test error',
        source: 'test',
      },
    ];
    setTimeout(() => {
      const ws = MockWebSocket.instances[0];
      if (ws.onmessage) {
        ws.onmessage({ data: JSON.stringify({ method: 'textDocument/publishDiagnostics', params: { uri: 'file:///test/index.ts', diagnostics: diag } }) });
      }
    }, 10);
    const result = await diagnosticsPromise;
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('Test error');
  });

  it('disconnects cleanly', async () => {
    const connectPromise = client.connect('ws://localhost:8765');
    setTimeout(() => {
      const ws = MockWebSocket.instances[0];
      ws.readyState = MockWebSocket.OPEN;
      if (ws.onopen) ws.onopen();
    }, 0);
    await connectPromise;
    client.disconnect();
    expect(MockWebSocket.instances[0].close).toHaveBeenCalled();
    expect(client.isConnected()).toBe(false);
  });

  it('openDocument sends didOpen notification', async () => {
    const connectPromise = client.connect('ws://localhost:8765');
    setTimeout(() => {
      const ws = MockWebSocket.instances[0];
      ws.readyState = MockWebSocket.OPEN;
      if (ws.onopen) ws.onopen();
    }, 0);
    await connectPromise;
    await client.openDocument('file:///test/index.ts', 'console.log(1)');
    const calls = MockWebSocket.instances[0].send.mock.calls;
    const didOpen = calls.find((c: any[]) => JSON.parse(c[0]).method === 'textDocument/didOpen');
    expect(didOpen).toBeDefined();
    if (!didOpen) return;
    const params = JSON.parse(didOpen[0]).params;
    expect(params.textDocument.uri).toBe('file:///test/index.ts');
    expect(params.textDocument.text).toBe('console.log(1)');
  });
});
