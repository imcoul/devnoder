import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { selectPanel } from './navigation';

test('preview builds an HTML entry with a linked project stylesheet', async ({ page }) => {
  await page.goto('/');
  const createBlank = page.getByRole('button', { name: 'Create blank project' });
  await expect(createBlank).toBeVisible();
  await createBlank.click();
  await page.getByLabel('Project name').fill('Project preview acceptance');
  await page.getByRole('button', { name: 'Create project' }).click();

  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await navigation.getByRole('button', { name: 'Git' }).click();
  await page.getByRole('tab', { name: /^Files/ }).click();
  await page.getByRole('button', { name: '+ New file' }).click();
  await page.getByRole('textbox', { name: 'Project-relative file path' }).fill('index.html');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await navigation.getByRole('button', { name: 'Code' }).click();
  await page.locator('.cm-content').click();
  await page.keyboard.type('<!doctype html><html><head><link rel="stylesheet" href="./style.css"></head><body><h1>Project tree preview</h1></body></html>');
  await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 10_000 });

  await navigation.getByRole('button', { name: 'Git' }).click();
  await page.getByRole('tab', { name: /^Files/ }).click();
  await page.getByRole('button', { name: '+ New file' }).click();
  await page.getByRole('textbox', { name: 'Project-relative file path' }).fill('style.css');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await navigation.getByRole('button', { name: 'Code' }).click();
  await page.locator('.cm-content').click();
  await page.keyboard.type('h1 { color: rgb(1, 2, 3); }');
  await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 10_000 });

  await navigation.getByRole('button', { name: 'Preview' }).click();
  const frame = page.locator('iframe[title="Live preview"]');
  await expect(frame).toBeVisible({ timeout: 10_000 });
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  const preview = page.frameLocator('iframe[title="Live preview"]');
  const heading = preview.getByRole('heading', { name: 'Project tree preview' });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS('color', 'rgb(1, 2, 3)');
});

test('recommended starter supports edit, preview, ZIP export, and reload recovery', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create web project' }).click();
  await page.getByLabel('Project name').fill('Starter journey');
  await page.getByRole('button', { name: 'Create and open index.html' }).click();

  const editor = page.locator('.cm-content');
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('<!doctype html><html><body><h1>Starter journey edited</h1></body></html>');
  await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 10_000 });

  await selectPanel(page, 'Preview');
  const frame = page.locator('iframe[title="Live preview"]');
  await expect(frame).toBeVisible({ timeout: 10_000 });
  await expect(page.frameLocator('iframe[title="Live preview"]').getByRole('heading', { name: 'Starter journey edited' })).toBeVisible();

  await selectPanel(page, 'Git');
  await page.getByRole('tab', { name: /^Files/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download project ZIP' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('starter-journey.zip');
  const archivePath = await download.path();
  const archive = unzipSync(new Uint8Array(await readFile(archivePath!)));
  expect(strFromU8(archive['index.html'])).toContain('Starter journey edited');
  expect(archive['.git/config']).toBeUndefined();

  await page.reload();
  await selectPanel(page, 'Code');
  await expect(page.locator('.cm-content')).toContainText('Starter journey edited');
});
