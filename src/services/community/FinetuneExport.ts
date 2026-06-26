// FinetuneExport.ts — real JSONL + DPO export, zero telemetry
import { feedbackStore, FeedbackEntry, Rating } from '../ai/FeedbackStore';

export type ExportFormat = 'alpaca' | 'chatml' | 'dpo';

export interface ExportStats {
  total: number;
  good: number;
  bad: number;
  edited: number;
  dpoPairs: number;
  dateRange: { from: number; to: number } | null;
  agents: string[];
}

function toAlpaca(entry: FeedbackEntry): string {
  const userMsg = entry.messages.filter(m => m.role === 'user').pop();
  const sysMsg  = entry.messages.find(m => m.role === 'system');
  return JSON.stringify({
    instruction: sysMsg?.content ?? `You are a ${entry.agentId} assistant.`,
    input: userMsg?.content ?? '',
    output: entry.editedResponse ?? entry.response,
  });
}

function toChatML(entry: FeedbackEntry): string {
  const messages = entry.messages
    .filter(m => m.role !== 'system')
    .concat([{ role: 'assistant', content: entry.editedResponse ?? entry.response }]);
  const system = entry.messages.find(m => m.role === 'system')?.content;
  return JSON.stringify({
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
  });
}

function toDPO(good: FeedbackEntry, bad: FeedbackEntry): string {
  const prompt = good.messages.filter(m => m.role !== 'system');
  return JSON.stringify({
    prompt: prompt.map(m => ({ role: m.role, content: m.content })),
    chosen:   [{ role: 'assistant', content: good.editedResponse ?? good.response }],
    rejected: [{ role: 'assistant', content: bad.response }],
  });
}

export const finetuneExport = {
  async getStats(): Promise<ExportStats> {
    const all = await feedbackStore.getAll();
    const timestamps = all.map(e => e.timestamp);
    const agentSet = new Set(all.map(e => e.agentId));

    const good    = all.filter(e => e.rating === 'good').length;
    const bad     = all.filter(e => e.rating === 'bad').length;
    const edited  = all.filter(e => e.rating === 'edited').length;
    const dpoPairs = Math.min(good + edited, bad);

    return {
      total: all.length, good, bad, edited, dpoPairs,
      dateRange: timestamps.length
        ? { from: Math.min(...timestamps), to: Math.max(...timestamps) }
        : null,
      agents: Array.from(agentSet),
    };
  },

  async export(format: ExportFormat, minRating: Rating[] = ['good', 'edited']): Promise<string> {
    const all = await feedbackStore.getAll();

    if (format === 'dpo') {
      const goodEntries = all.filter(e => e.rating === 'good' || e.rating === 'edited');
      const badEntries  = all.filter(e => e.rating === 'bad');
      const pairs: string[] = [];
      const limit = Math.min(goodEntries.length, badEntries.length);
      for (let i = 0; i < limit; i++) {
        pairs.push(toDPO(goodEntries[i], badEntries[i]));
      }
      if (pairs.length === 0) throw new Error('Need at least one good and one bad rated response to generate DPO pairs.');
      return pairs.join('\n');
    }

    const filtered = all.filter(e => minRating.includes(e.rating));
    if (filtered.length === 0) throw new Error('No entries match the selected filters. Rate some AI responses first.');

    const lines = format === 'alpaca'
      ? filtered.map(toAlpaca)
      : filtered.map(toChatML);

    // Mark as exported
    const ids = filtered.map(e => e.id!).filter(Boolean);
    await feedbackStore.markExported(ids);

    return lines.join('\n');
  },

  download(content: string, format: ExportFormat): void {
    const filename = `devnoder-finetune-${format}-${new Date().toISOString().split('T')[0]}.jsonl`;
    const blob = new Blob([content], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
};
