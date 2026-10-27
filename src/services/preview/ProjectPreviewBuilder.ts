export interface ProjectPreviewBuild {
  html: string;
  warnings: string[];
}

function resolveProjectPath(fromPath: string, reference: string): string | null {
  const raw = reference.trim();
  if (!raw || raw.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw)) return null;
  let pathname = raw.split(/[?#]/, 1)[0];
  try { pathname = decodeURIComponent(pathname); } catch { return null; }
  const parts = pathname.startsWith('/') ? [] : fromPath.split('/').slice(0, -1);
  for (const part of pathname.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.length ? parts.join('/') : null;
}

function embedSvg(value: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
}

function rewriteCssUrls(css: string, cssPath: string, files: Record<string, string>, warnings: string[]): string {
  return css.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (match, quote: string, reference: string) => {
    const path = resolveProjectPath(cssPath, reference);
    if (!path) return match;
    const content = files[path];
    if (content === undefined) {
      warnings.push(`Preview could not find local CSS asset “${reference}” referenced by ${cssPath}.`);
      return 'url("data:, ")';
    }
    if (!path.toLowerCase().endsWith('.svg')) {
      warnings.push(`Local binary asset “${path}” is not embedded by the text-file preview.`);
      return 'url("data:, ")';
    }
    return `url("${embedSvg(content)}")`;
  });
}

/** Build a sandboxed, self-contained preview for a basic static HTML project. */
export function buildProjectPreviewHtml(files: Record<string, string>, entryPath: string): ProjectPreviewBuild {
  const source = files[entryPath];
  if (source === undefined) throw new Error(`The preview entry file ${entryPath} does not exist in this project.`);
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const warnings: string[] = [];

  for (const link of Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]'))) {
    const reference = link.getAttribute('href') ?? '';
    const path = resolveProjectPath(entryPath, reference);
    if (!path) {
      warnings.push(`External stylesheet “${reference}” is blocked in the isolated preview.`);
      link.remove();
      continue;
    }
    const css = files[path];
    if (css === undefined) {
      warnings.push(`Preview could not find stylesheet “${path}”.`);
      link.remove();
      continue;
    }
    const style = doc.createElement('style');
    style.textContent = rewriteCssUrls(css, path, files, warnings).replace(/<\/style/gi, '<\\/style');
    link.replaceWith(style);
  }

  for (const script of Array.from(doc.querySelectorAll<HTMLScriptElement>('script[src]'))) {
    const reference = script.getAttribute('src') ?? '';
    const path = resolveProjectPath(entryPath, reference);
    if (!path) {
      warnings.push(`External script “${reference}” is blocked in the isolated preview.`);
      script.remove();
      continue;
    }
    const code = files[path];
    if (code === undefined) {
      warnings.push(`Preview could not find script “${path}”.`);
      script.remove();
      continue;
    }
    const scriptType = (script.getAttribute('type') ?? '').toLowerCase();
    if (scriptType === 'module' && /\b(?:import\s*(?:\(|['"]|[^;]*\bfrom\s*['"])|export\s+[^;]*\bfrom\s*['"])/.test(code)) {
      warnings.push(`Module script “${path}” imports other files; module graphs and package builds are not supported by this in-browser preview.`);
      script.remove();
      continue;
    }
    script.removeAttribute('src');
    script.textContent = code.replace(/<\/script/gi, '<\\/script');
  }

  for (const style of Array.from(doc.querySelectorAll<HTMLStyleElement>('style'))) {
    style.textContent = rewriteCssUrls(style.textContent ?? '', entryPath, files, warnings)
      .replace(/<\/style/gi, '<\\/style');
  }

  for (const element of Array.from(doc.querySelectorAll<HTMLElement>('[style]'))) {
    const cssPath = entryPath;
    element.setAttribute('style', rewriteCssUrls(element.getAttribute('style') ?? '', cssPath, files, warnings));
  }

  for (const element of Array.from(doc.querySelectorAll<HTMLImageElement>('img[src], source[src]'))) {
    const reference = element.getAttribute('src') ?? '';
    const path = resolveProjectPath(entryPath, reference);
    if (!path) {
      if (/^(?:https?:|\/\/)/i.test(reference)) warnings.push(`External image or media “${reference}” is blocked in the isolated preview.`);
      continue;
    }
    const content = files[path];
    if (content === undefined) {
      warnings.push(`Preview could not find image or media “${path}”.`);
      element.removeAttribute('src');
    } else if (path.toLowerCase().endsWith('.svg')) {
      element.setAttribute('src', embedSvg(content));
    } else {
      warnings.push(`Local binary asset “${path}” is not embedded by the text-file preview.`);
      element.setAttribute('src', 'data:,');
    }
  }

  for (const anchor of Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const reference = anchor.getAttribute('href') ?? '';
    const path = resolveProjectPath(entryPath, reference);
    if (path && /\.html?$/i.test(path)) {
      warnings.push(`Navigation to another local page (“${path}”) is not yet supported in this single-entry preview.`);
      anchor.setAttribute('href', '#');
    } else if (!path && /^(?:https?:|\/\/)/i.test(reference)) {
      warnings.push(`External link “${reference}” is blocked by the isolated preview policy.`);
      anchor.setAttribute('href', '#');
    }
  }

  doc.querySelectorAll('meta[http-equiv="Content-Security-Policy" i], base, meta[http-equiv="refresh" i]')
    .forEach(element => element.remove());
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'";
  doc.head.prepend(policy);

  return { html: `<!doctype html>${doc.documentElement.outerHTML}`, warnings: [...new Set(warnings)] };
}
