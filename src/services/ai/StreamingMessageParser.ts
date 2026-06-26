// StreamingMessageParser.ts — bolt-style boltAction XML parser
export type ActionType = 'file' | 'shell' | 'start';

export interface BoltAction {
  type: ActionType;
  filePath?: string;
  content: string;
}

export interface ParsedMessage {
  textBefore: string;
  actions: BoltAction[];
  textAfter: string;
}

const ACTION_RE = /<boltAction\s+type="([^"]+)"(?:\s+filePath="([^"]+)")?>([\s\S]*?)<\/boltAction>/g;

export function parseMessage(text: string): ParsedMessage {
  const actions: BoltAction[] = [];
  let lastIndex = 0;
  let textBefore = '';
  let match: RegExpExecArray | null;

  ACTION_RE.lastIndex = 0;
  while ((match = ACTION_RE.exec(text)) !== null) {
    if (lastIndex === 0) textBefore = text.slice(0, match.index).trim();
    actions.push({
      type: match[1] as ActionType,
      filePath: match[2],
      content: match[3].trim(),
    });
    lastIndex = match.index + match[0].length;
  }

  return {
    textBefore,
    actions,
    textAfter: lastIndex > 0 ? text.slice(lastIndex).trim() : text.trim(),
  };
}

/** Stream-safe: detect if we're inside a boltAction tag */
export function isInsideAction(partial: string): boolean {
  const opens  = (partial.match(/<boltAction/g) ?? []).length;
  const closes = (partial.match(/<\/boltAction>/g) ?? []).length;
  return opens > closes;
}
