// AgentLoop.ts — multi-turn conversation orchestration with persistence and guardrails.
import { aiGateway, type Message, type StreamChunk, type ToolCallEvent } from './AIGateway';
import { conversationStore, type Conversation } from './ConversationStore';
import type { AgentId } from './AIAgents';

export interface AgentLoopOptions {
  conversationId?: string;
  agentId?: AgentId;
  maxTurns?: number;
  onChunk?: (chunk: StreamChunk) => void;
  onTurn?: (turn: number, toolCalls: ToolCallEvent[]) => void;
}

export interface AgentLoopResult {
  conversationId: string;
  response: string;
  turns: number;
  toolCalls: ToolCallEvent[];
}

const DEFAULT_MAX_TURNS = 8;

export class AgentLoop {
  private abortController: AbortController | null = null;
  private currentConversationId: string | null = null;

  abort() {
    this.abortController?.abort();
    this.abortController = null;
  }

  async run(userMessage: string, opts: AgentLoopOptions = {}): Promise<AgentLoopResult> {
    const { conversationId: providedId, agentId, maxTurns = DEFAULT_MAX_TURNS, onChunk, onTurn } = opts;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const conversationId = providedId ?? await conversationStore.create('Chat');
    this.currentConversationId = conversationId;

    await conversationStore.addMessage(conversationId, { role: 'user', content: userMessage });
    const history = await this.buildHistory(conversationId);

    let fullResponse = '';
    const toolCalls: ToolCallEvent[] = [];
    let turns = 0;

    await aiGateway.stream(
      history,
      chunk => {
        fullResponse += chunk.delta;
        if (chunk.toolCall) toolCalls.push(chunk.toolCall);
        onChunk?.(chunk);
      },
      signal,
    );

    turns = this.countTurns(history, fullResponse);

    await conversationStore.addMessage(conversationId, {
      role: 'assistant',
      content: fullResponse,
      ...(toolCalls.length ? { tool_call_id: toolCalls[toolCalls.length - 1].id, tool_name: toolCalls[toolCalls.length - 1].name } : {}),
    });

    onTurn?.(turns, toolCalls);

    return { conversationId, response: fullResponse, turns, toolCalls };
  }

  private async buildHistory(conversationId: string): Promise<Message[]> {
    const msgs = await conversationStore.getMessages(conversationId, 200);
    const system = msgs.filter(m => m.role === 'system');
    const rest = msgs.filter(m => m.role !== 'system');
    const trimmed = rest.slice(-10);
    return [...system, ...trimmed];
  }

  private countTurns(history: Message[], response: string): number {
    let turns = 0;
    for (const m of history) {
      if (m.role === 'assistant') turns++;
    }
    return Math.max(turns, response ? 1 : 0);
  }

  getCurrentConversationId(): string | null {
    return this.currentConversationId;
  }
}

export const agentLoop = new AgentLoop();
