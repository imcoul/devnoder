// SecretDetector.ts — 14 patterns, runs locally, zero network
export interface SecretMatch {
  type: string;
  line: number;
  col: number;
  match: string; // redacted
}

const PATTERNS: Array<{ type: string; re: RegExp }> = [
  { type: 'AWS Access Key',        re: /AKIA[0-9A-Z]{16}/g },
  { type: 'AWS Secret Key',        re: /(?<![A-Za-z0-9])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/g },
  { type: 'GitHub Token',          re: /ghp_[A-Za-z0-9]{36}/g },
  { type: 'GitHub Fine-grained',   re: /github_pat_[A-Za-z0-9_]{82}/g },
  { type: 'Slack Token',           re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
  { type: 'Stripe Secret Key',     re: /sk_live_[A-Za-z0-9]{24}/g },
  { type: 'Stripe Publishable Key',re: /pk_live_[A-Za-z0-9]{24}/g },
  { type: 'Private Key',           re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/g },
  { type: 'Generic API Key',       re: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{20,}/gi },
  { type: 'Generic Secret',        re: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{8,}/gi },
  { type: 'Bearer Token',          re: /Bearer\s+[A-Za-z0-9\-_=.]{20,}/g },
  { type: 'JWT',                   re: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/]*/g },
  { type: 'Cloudflare API Token',  re: /[A-Za-z0-9_-]{40}/g },
  { type: 'Google API Key',        re: /AIza[0-9A-Za-z_\-]{35}/g },
];

export function detectSecrets(code: string, filename = ''): SecretMatch[] {
  // Never scan .env.example or test fixtures
  if (/\.(example|test|spec|mock)\b/.test(filename)) return [];

  const results: SecretMatch[] = [];
  const lines = code.split('\n');

  lines.forEach((line, lineIdx) => {
    // Skip comments
    if (/^\s*(\/\/|#|\/\*)/.test(line)) return;
    for (const { type, re } of PATTERNS) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(line)) !== null) {
        results.push({
          type,
          line: lineIdx + 1,
          col: match.index + 1,
          match: match[0].slice(0, 4) + '****',
        });
      }
    }
  });

  return results;
}
