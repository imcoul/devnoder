import { describe, expect, it } from 'vitest';
import { TemplateService } from './TemplateService';

describe('TemplateService capability metadata', () => {
  it('marks the vanilla starter as browser-runnable and framework starters as external work', () => {
    const templates = new TemplateService().list();
    expect(templates.find(template => template.id === 'vanilla')).toMatchObject({
      capability: 'browser-static',
      runtimeNote: expect.stringContaining('Runs here'),
    });
    expect(templates.find(template => template.id === 'react-vite-ts')).toMatchObject({
      capability: 'scaffold',
      runtimeNote: expect.stringContaining('outside DevNoder'),
    });
    expect(templates.find(template => template.id === 'flutter')).toMatchObject({
      capability: 'external-runtime',
      runtimeNote: expect.stringContaining('Flutter SDK'),
    });
  });

  it('keeps preview generation available for the browser-static starter', () => {
    const files = new TemplateService().preview('vanilla');
    expect(files['index.html']).toContain('<script src="app.js"></script>');
    expect(files['style.css']).toBeTruthy();
    expect(files['app.js']).toBeTruthy();
  });
});
