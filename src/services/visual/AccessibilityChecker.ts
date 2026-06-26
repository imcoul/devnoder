// AccessibilityChecker.ts — 8 WCAG checks, real-time, zero network
export interface A11yIssue {
  rule: string;
  severity: 'error' | 'warning';
  element: string;
  message: string;
  wcag: string;
}

function contrastRatio(hex1: string, hex2: string): number {
  const lum = (hex: string): number => {
    const rgb = parseInt(hex.replace('#', ''), 16);
    const r = ((rgb >> 16) & 255) / 255;
    const g = ((rgb >> 8) & 255) / 255;
    const b = (rgb & 255) / 255;
    const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };
  const l1 = lum(hex1), l2 = lum(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function checkAccessibility(html: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(html, 'text/html');
  } catch { return []; }

  // 1. Images missing alt
  doc.querySelectorAll('img').forEach(img => {
    if (!img.hasAttribute('alt')) {
      issues.push({ rule: 'img-alt', severity: 'error', element: img.outerHTML.slice(0, 60),
        message: 'Image is missing an alt attribute', wcag: '1.1.1' });
    }
  });

  // 2. Buttons with no accessible name
  doc.querySelectorAll('button').forEach(btn => {
    if (!btn.textContent?.trim() && !btn.getAttribute('aria-label') && !btn.getAttribute('aria-labelledby')) {
      issues.push({ rule: 'button-name', severity: 'error', element: btn.outerHTML.slice(0, 60),
        message: 'Button has no accessible name', wcag: '4.1.2' });
    }
  });

  // 3. Links with no text
  doc.querySelectorAll('a').forEach(a => {
    if (!a.textContent?.trim() && !a.getAttribute('aria-label')) {
      issues.push({ rule: 'link-name', severity: 'error', element: a.outerHTML.slice(0, 60),
        message: 'Link has no accessible name', wcag: '2.4.4' });
    }
  });

  // 4. Form inputs without labels
  doc.querySelectorAll('input, select, textarea').forEach(input => {
    const id = input.getAttribute('id');
    const hasLabel = id && doc.querySelector(`label[for="${id}"]`);
    const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
    if (!hasLabel && !hasAriaLabel) {
      issues.push({ rule: 'label', severity: 'error', element: (input as Element).outerHTML.slice(0, 60),
        message: 'Form input has no associated label', wcag: '1.3.1' });
    }
  });

  // 5. Heading hierarchy
  const headings = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .map(h => parseInt(h.tagName[1]));
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] - headings[i - 1] > 1) {
      issues.push({ rule: 'heading-order', severity: 'warning', element: `h${headings[i]}`,
        message: `Heading level skipped (h${headings[i-1]} → h${headings[i]})`, wcag: '1.3.1' });
    }
  }

  // 6. Language attribute
  if (!doc.documentElement.getAttribute('lang')) {
    issues.push({ rule: 'html-lang', severity: 'error', element: '<html>',
      message: 'Page language not declared', wcag: '3.1.1' });
  }

  // 7. Tab index > 0 (anti-pattern)
  doc.querySelectorAll('[tabindex]').forEach(el => {
    if (parseInt(el.getAttribute('tabindex') ?? '0') > 0) {
      issues.push({ rule: 'tabindex', severity: 'warning', element: el.tagName,
        message: 'Positive tabindex disrupts natural focus order', wcag: '2.4.3' });
    }
  });

  // 8. Empty table headers
  doc.querySelectorAll('th').forEach(th => {
    if (!th.textContent?.trim()) {
      issues.push({ rule: 'th-empty', severity: 'warning', element: th.outerHTML.slice(0, 60),
        message: 'Table header cell is empty', wcag: '1.3.1' });
    }
  });

  return issues;
}
