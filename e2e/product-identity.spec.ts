import { expect, test } from '@playwright/test';
import { selectPanel } from './navigation';

test('identity and blank-project handoff lead directly to a saved file in Code', async ({ page }) => {
  const modelRequests: string[] = [];
  page.on('request', request => { if (/huggingface\.co|\.onnx(?:\?|$)/.test(request.url())) modelRequests.push(request.url()); });
  await page.goto('/');
  await expect(page.getByText('Build something useful, wherever you work.', { exact: true })).toBeVisible();
  await expect(page.getByText('by Srvel', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Your files stay in this browser/).first()).toBeVisible();
  await page.getByRole('button', { name: /^Create blank project/ }).click();
  await page.getByLabel('Project name').fill('Direct Code journey');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await selectPanel(page, 'Code');
  await page.locator('.code-panel-editor').getByRole('button', { name: 'Create your first file' }).click();
  await page.getByLabel('New file path', { exact: true }).fill('hello.js');
  await page.getByRole('button', { name: 'Create file', exact: true }).click();
  await page.locator('.cm-content').click();
  await page.keyboard.type('console.log("direct Code handoff");');
  await expect(page.locator('.code-panel-editor').getByRole('status')).toHaveText('Saved');
  expect(modelRequests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('More tools preserves focus and responsive Settings opens the single AI setup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Create blank project/ }).click();
  await page.getByLabel('Project name').fill('Settings journey');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await selectPanel(page, 'Code');
  const more = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'More' });
  await more.click();
  await expect(page.getByRole('dialog', { name: 'More tools' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'More tools' })).toHaveCount(0);
  await expect(more).toBeFocused();
  await selectPanel(page, 'Settings');
  await page.getByRole('button', { name: /AI & API Keys|AI.*Keys|AI setup/ }).first().click();
  await page.getByRole('button', { name: 'Open AI workspace', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
