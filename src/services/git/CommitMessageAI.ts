// CommitMessageAI.ts — conventional commits from diff, runs via AI gateway
import { FileStatus } from './GitService';

const CONVENTIONAL_TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf', 'ci', 'build'];

function guessType(files: FileStatus[]): string {
  const paths = files.map(f => f.path);
  if (paths.some(p => /\.(test|spec)\.(ts|tsx|js)$/.test(p))) return 'test';
  if (paths.some(p => /\.md$/i.test(p))) return 'docs';
  if (paths.some(p => /\.(css|scss|sass)$/.test(p))) return 'style';
  if (paths.some(p => /\/(ci|workflows?)\//i.test(p))) return 'ci';
  if (paths.some(p => /package\.json|vite\.config|tsconfig/.test(p))) return 'build';
  if (files.some(f => f.status === 'added')) return 'feat';
  if (files.some(f => f.status === 'deleted')) return 'chore';
  return 'fix';
}

function guessScope(files: FileStatus[]): string | null {
  const dirs = files.map(f => f.path.split('/')[1]).filter(Boolean);
  const freq = dirs.reduce((acc, d) => { acc[d] = (acc[d] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? null;
}

export interface GeneratedCommit {
  message: string;
  type: string;
  scope: string | null;
  subject: string;
  body?: string;
}

export async function generateCommitMessage(
  files: FileStatus[],
  diff?: string,
): Promise<GeneratedCommit> {
  const type = guessType(files);
  const scope = guessScope(files);

  // Try AI gateway if available
  try {
    const { aiGateway } = await import('../ai/AIGateway');
    const prompt = [
      'Generate a conventional commit message for these changed files:',
      files.map(f => `  ${f.status}: ${f.path}`).join('\n'),
      diff ? `\nDiff preview:\n${diff.slice(0, 800)}` : '',
      '\nRespond with ONLY the commit message in format: type(scope): subject',
      'Types: feat fix docs style refactor test chore perf ci build',
    ].join('\n');

    const result = await aiGateway.complete(prompt, { maxTokens: 80, temperature: 0.3 });
    const match = result.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/m);
    if (match) {
      return {
        message: match[0].trim(),
        type: match[1], scope: match[2] ?? null, subject: match[3],
      };
    }
  } catch { /* fall through to heuristic */ }

  // Heuristic fallback
  const fileNames = files.slice(0, 3).map(f => f.path.split('/').pop()).join(', ');
  const subject = `update ${fileNames}${files.length > 3 ? ` and ${files.length - 3} more` : ''}`;
  const scopePart = scope ? `(${scope})` : '';
  const message = `${type}${scopePart}: ${subject}`;

  return { message, type, scope, subject };
}

export function formatConventional(type: string, scope: string | null, subject: string, body?: string): string {
  const header = `${type}${scope ? `(${scope})` : ''}: ${subject}`;
  return body ? `${header}\n\n${body}` : header;
}
