import React from 'react';

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNo?: number;
}

function parseUnifiedDiff(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  const regex = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
  let oldLine = 0;
  let newLine = 0;

  for (const raw of patch.split('\n')) {
    if (raw.startsWith('@@')) {
      const m = regex.exec(raw);
      if (m) {
        oldLine = Number(m[1]);
        newLine = Number(m[2]);
      }
      continue;
    }
    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      lines.push({ type: 'add', content: raw.slice(1), lineNo: newLine++ });
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      lines.push({ type: 'remove', content: raw.slice(1), lineNo: oldLine++ });
    } else if (raw.startsWith(' ')) {
      lines.push({ type: 'context', content: raw.slice(1), lineNo: newLine++ });
      oldLine++;
    }
  }
  return lines;
}

export default function DiffViewer({ patch, filename }: { patch: string; filename?: string }) {
  const lines = parseUnifiedDiff(patch);

  return (
    <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-code)', lineHeight: 1.5, background: 'var(--color-canvas)', borderRadius: '0.3rem', overflow: 'auto' }}>
      {filename && <div style={{ padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>{filename}</div>}
      {lines.map((line, i) => (
        <div key={i} style={{
          display: 'flex',
          background: line.type === 'add' ? '#22c55e15' : line.type === 'remove' ? '#ef444415' : 'transparent',
          color: line.type === 'add' ? 'var(--color-success)' : line.type === 'remove' ? 'var(--color-error)' : 'var(--color-text)',
        }}>
          <span style={{ width: '3rem', textAlign: 'right', paddingRight: '0.6rem', color: 'var(--color-text-muted)', userSelect: 'none', flexShrink: 0 }}>
            {line.lineNo ?? ''}
          </span>
          <span style={{ width: '1.5rem', textAlign: 'center', flexShrink: 0 }}>{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}</span>
          <span style={{ whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line.content}</span>
        </div>
      ))}
    </div>
  );
}
