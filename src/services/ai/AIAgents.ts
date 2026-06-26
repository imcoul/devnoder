// AIAgents.ts — 7 agents: code, review, debug, test, docs, deploy, commit
import { aiGateway, Message } from './AIGateway';
import { skillsEngine } from './SkillsEngine';
import { $activeBuffer, $buffers } from '../editor/BufferManager';
import { diffTracker } from './DiffTracker';

export type AgentId = 'code' | 'review' | 'debug' | 'test' | 'docs' | 'deploy' | 'commit';

export interface Agent {
  id: AgentId; label: string; icon: string; description: string; systemPrompt: string;
}

export const AGENTS: Agent[] = [
  {
    id: 'code', label: 'Code', icon: '💻', description: 'Write and edit code',
    systemPrompt: `You are an expert coding assistant for DevNoder, a mobile-first offline PWA IDE.
Stack: React + Vite + TypeScript, Cloudflare Workers, isomorphic-git, CodeMirror 6.
Always use CSS logical properties (margin-inline-start not margin-left).
When generating files, wrap them in: <boltAction type="file" filePath="path/to/file">content</boltAction>
For shell commands: <boltAction type="shell">command</boltAction>
Keep responses concise. Srvel brand: #40E0D0 turquoise, #FFFF80 yellow, #800080 purple, #0D1F1E canvas.`,
  },
  {
    id: 'review', label: 'Review', icon: '🔍', description: 'Code review and suggestions',
    systemPrompt: `You are a senior code reviewer. Analyse the provided code for:
- Security vulnerabilities, especially secret exposure
- Performance issues (unnecessary re-renders, missing memoisation, large bundles)
- Accessibility (WCAG 2.1 AA)
- CSS logical properties compliance (RTL support)
- TypeScript type safety
Give concrete, actionable feedback. Rate severity: critical / warning / suggestion.`,
  },
  {
    id: 'debug', label: 'Debug', icon: '🐛', description: 'Find and fix bugs',
    systemPrompt: `You are an expert debugger. When given an error or unexpected behaviour:
1. Identify the root cause precisely
2. Explain WHY it happens
3. Provide the fix as a boltAction file patch
4. Suggest how to prevent recurrence
Focus on runtime errors, TypeScript type errors, and React rendering issues.`,
  },
  {
    id: 'test', label: 'Test', icon: '🧪', description: 'Write Vitest unit tests',
    systemPrompt: `You write comprehensive Vitest unit tests for TypeScript/React code.
Follow AAA pattern (Arrange, Act, Assert).
Use @testing-library/react for components.
Mock external dependencies (fetch, IndexedDB, WebSocket).
Aim for edge cases: empty state, error state, loading state.
Output tests as boltAction file blocks.`,
  },
  {
    id: 'docs', label: 'Docs', icon: '📝', description: 'Generate documentation',
    systemPrompt: `You write clear, concise technical documentation.
Format: JSDoc for functions/classes, Markdown for guides.
Include: purpose, parameters, return values, usage examples.
For APIs: include request/response examples.
Keep it developer-friendly, no fluff.`,
  },
  {
    id: 'deploy', label: 'Deploy', icon: '🚀', description: 'Cloudflare deployment help',
    systemPrompt: `You are a Cloudflare deployment expert.
DevNoder uses: Pages (PWA), Workers (API/execution), D1 (database), R2 (storage), Durable Objects (collab).
All infrastructure is 100% Cloudflare free tier.
Help with: wrangler.toml config, Worker code, D1 migrations, CI/CD via GitHub Actions.
Always provide exact wrangler CLI commands.`,
  },
  {
    id: 'commit', label: 'Commit', icon: '📦', description: 'Conventional commit messages',
    systemPrompt: `You generate conventional commit messages from diffs.
Format: type(scope): subject
Types: feat fix docs style refactor test chore perf ci build
Rules: imperative mood, max 72 chars, no period at end.
If multiple concerns: suggest splitting into multiple commits.
Respond with ONLY the commit message, nothing else.`,
  },
];

export class AIAgentRunner {
  private abortController: AbortController | null = null;

  getAgent(id: AgentId): Agent {
    return AGENTS.find(a => a.id === id) ?? AGENTS[0];
  }

  abort() { this.abortController?.abort(); }

  async run(
    agentId: AgentId,
    userMessage: string,
    history: Message[],
    onChunk: (delta: string) => void,
  ): Promise<string> {
    this.abortController = new AbortController();
    const agent = this.getAgent(agentId);

    // Attach diff context for code/review/debug agents
    let context = userMessage;
    if (['code', 'review', 'debug'].includes(agentId)) {
      const diff = diffTracker.getDiff();
      if (diff) context += `\n\n<currentDiff>\n${diff}\n</currentDiff>`;
    }

    const activeId  = $activeBuffer.get();
    const buffers   = $buffers.get();
    const activeBuf = buffers.find(b => b.id === activeId);

    const rawMessages: Message[] = [
      { role: 'system', content: agent.systemPrompt },
      ...history.slice(-10),
      { role: 'user', content: context },
    ];

    // Apply Skills Engine
    const messages = await skillsEngine.process(rawMessages, {
      agentId,
      language:          activeBuf?.language,
      userMessage:       context,
      activeFileContent: activeBuf?.content,
      activeFilePath:    activeBuf?.path,
    });

    let fullResponse = '';
    await aiGateway.stream(
      messages,
      chunk => {
        if (typeof chunk === 'string') {
          fullResponse += chunk;
          onChunk(chunk);
        } else if (chunk && typeof chunk === 'object') {
          if ('delta' in chunk) { fullResponse += chunk.delta; onChunk(chunk.delta); }
          else onChunk(chunk as any);
        }
      },
      this.abortController.signal,
    );

    diffTracker.snapshot();
    return fullResponse;
  }
}

export const agentRunner = new AIAgentRunner();
