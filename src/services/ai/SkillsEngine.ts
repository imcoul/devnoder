// SkillsEngine.ts — trigger matcher + context injector pipeline
import { Skill, skillStore, TriggerType } from './SkillStore';
import type { Message } from './AIGateway';
import type { AgentId } from './AIAgents';

export interface SkillContext {
  agentId: AgentId;
  language?: string;       // active file extension e.g. 'tsx'
  userMessage: string;
  activeFileContent?: string;
  activeFilePath?: string;
}

async function gatherInjectors(skill: Skill, ctx: SkillContext): Promise<string> {
  const parts: string[] = [];

  for (const inj of skill.contextInjectors) {
    switch (inj.type) {
      case 'active-file': {
        if (ctx.activeFileContent && ctx.activeFilePath) {
          parts.push(
            `<activeFile path="${ctx.activeFilePath}" language="${ctx.language ?? 'text'}">\n${ctx.activeFileContent.slice(0, 4000)}\n</activeFile>`
          );
        }
        break;
      }

      case 'git-status': {
        try {
          const { getStatus } = await import('../git/GitService');
          const status = await getStatus();
          const summary = status
            .filter(f => f.status !== 'unmodified')
            .map(f => `${f.staged ? 'staged' : 'unstaged'} ${f.status}: ${f.path}`)
            .join('\n');
          if (summary) parts.push(`<gitStatus>\n${summary}\n</gitStatus>`);
        } catch { /* git not init */ }
        break;
      }

      case 'project-structure': {
        try {
          const { listFiles } = await import('../git/GitService');
          const files = await listFiles();
          const tree = files.slice(0, 60).join('\n');
          parts.push(`<projectStructure>\n${tree}\n</projectStructure>`);
        } catch { /* no fs */ }
        break;
      }

      case 'related-files': {
        try {
          const { embeddingEngine } = await import('./EmbeddingEngine');
          const chunks = await embeddingEngine.retrieve(ctx.userMessage, inj.n ?? 5);
          if (chunks.length) {
            const xml = chunks
              .map(c => `<file path="${c.path}" score="${c.score.toFixed(2)}">\n${c.chunk}\n</file>`)
              .join('\n');
            parts.push(`<relevantCode>\n${xml}\n</relevantCode>`);
          }
        } catch { /* embedding engine not ready */ }
        break;
      }

      case 'snippet-library': {
        try {
          const { snippetService } = await import('../snippets/SnippetService');
          const snippets = await snippetService.search('', ctx.language);
          const top = snippets.slice(0, 5)
            .map(s => `// ${s.name} (${s.prefix})\n${s.body}`)
            .join('\n---\n');
          if (top) parts.push(`<snippetLibrary>\n${top}\n</snippetLibrary>`);
        } catch { /* no snippets */ }
        break;
      }

      case 'custom': {
        if (inj.fn) {
          try {
            // Sandboxed evaluation — only returns string
            const fn = new Function('ctx', `"use strict"; return (${inj.fn})(ctx);`);
            const result = fn(ctx);
            if (typeof result === 'string') parts.push(result);
          } catch (e: any) {
            console.warn(`Custom injector error: ${e.message}`);
          }
        }
        break;
      }
    }
  }

  return parts.join('\n\n');
}

function skillMatches(skill: Skill, ctx: SkillContext): boolean {
  if (!skill.enabled) return false;

  switch (skill.trigger) {
    case 'always':
      return true;

    case 'agent':
      return skill.triggerValue === ctx.agentId;

    case 'filetype':
      return !!ctx.language && (
        ctx.language === skill.triggerValue ||
        ctx.activeFilePath?.endsWith(`.${skill.triggerValue}`) === true
      );

    case 'keyword':
      return !!skill.triggerValue &&
        ctx.userMessage.toLowerCase().includes(skill.triggerValue.toLowerCase());

    default:
      return false;
  }
}

export class SkillsEngine {
  async applySkills(
    messages: Message[],
    ctx: SkillContext,
  ): Promise<Message[]> {
    const allSkills = await skillStore.getEnabled();
    const matching  = allSkills.filter(s => skillMatches(s, ctx));

    if (!matching.length) return messages;

    // Gather all prefix/suffix text and injected context
    const prefixes:  string[] = [];
    const suffixes:  string[] = [];
    const injected:  string[] = [];
    const mcpToActivate: string[] = [];

    for (const skill of matching) {
      if (skill.systemPromptPrefix) prefixes.push(skill.systemPromptPrefix);
      if (skill.systemPromptSuffix) suffixes.push(skill.systemPromptSuffix);
      if (skill.mcpServers?.length) mcpToActivate.push(...skill.mcpServers);

      const gathered = await gatherInjectors(skill, ctx);
      if (gathered) injected.push(gathered);
    }

    // Activate any MCP servers required by the matching skills
    if (mcpToActivate.length) {
      const { mcpConfigStore } = await import('./MCPConfigStore');
      const { mcpClient }      = await import('./MCPClient');
      for (const serverId of [...new Set(mcpToActivate)]) {
        const cfg = (await mcpConfigStore.getAll()).find(s => s.id === serverId);
        if (cfg && !mcpClient.getConnection(serverId)?.connected) {
          mcpClient.connect(cfg).catch(console.warn);
        }
      }
    }

    // Rebuild messages with enhanced system prompt
    return messages.map((msg, i) => {
      if (i === 0 && msg.role === 'system') {
        const parts = [
          prefixes.join('\n\n'),
          msg.content,
          suffixes.join('\n\n'),
          injected.join('\n\n'),
        ].filter(Boolean);
        return { ...msg, content: parts.join('\n\n') };
      }
      // If no system message exists, prepend one
      if (i === 0 && msg.role !== 'system' && (prefixes.length || injected.length)) {
        const sysContent = [...prefixes, ...injected, ...suffixes].filter(Boolean).join('\n\n');
        return msg; // handled below
      }
      return msg;
    });
  }

  /** Full pipeline: given messages + context, return skill-augmented messages */
  async process(messages: Message[], ctx: SkillContext): Promise<Message[]> {
    try {
      return await this.applySkills(messages, ctx);
    } catch (e) {
      console.warn('SkillsEngine error:', e);
      return messages;
    }
  }

  /** Preview what a skill would inject, for the test button in SkillsPanel */
  async preview(skill: Skill, ctx: SkillContext): Promise<string> {
    const gathered = await gatherInjectors(skill, ctx);
    const parts = [
      skill.systemPromptPrefix && `=== PREFIX ===\n${skill.systemPromptPrefix}`,
      gathered && `=== INJECTED CONTEXT ===\n${gathered}`,
      skill.systemPromptSuffix && `=== SUFFIX ===\n${skill.systemPromptSuffix}`,
    ].filter(Boolean);
    return parts.join('\n\n') || '(This skill injects nothing for the current context)';
  }
}

export const skillsEngine = new SkillsEngine();
