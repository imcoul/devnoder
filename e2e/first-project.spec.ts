import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { strFromU8, unzipSync } from 'fflate';

test('create a project, create and edit a source file, then recover it after reload', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') pageErrors.push(message.text()); });
  await page.goto('/');
  await page.waitForTimeout(500);
  if (await page.getByRole('button', { name: 'Create blank project' }).count() === 0) {
    throw new Error(`First-run UI did not render. Browser errors: ${pageErrors.join(' | ')}. Body: ${await page.locator('body').innerText()}`);
  }
  const createBlank = page.getByRole('button', { name: 'Create blank project' });
  await expect(createBlank).toBeVisible();

  await page.getByRole('button', { name: 'Create blank project' }).click();
  await page.getByLabel('Project name').fill('Browser acceptance project');
  await page.getByRole('button', { name: 'Create project' }).click();

  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation.getByRole('button', { name: /code/i })).toBeVisible();
  await navigation.getByRole('button', { name: /git/i }).click();
  await page.getByRole('tab', { name: /^Files/ }).click();
  await page.getByRole('button', { name: '+ New file' }).click();
  await page.getByRole('textbox', { name: 'Project-relative file path' }).fill('src/main.js');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('button', { name: 'src/main.js' })).toBeVisible({ timeout: 10_000 });

  await navigation.getByRole('button', { name: /code/i }).click();
  const editor = page.locator('.cm-content');
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.type('console.log("saved across reload");');
  await expect(editor).toContainText('saved across reload');
  await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 10_000 });

  await navigation.getByRole('button', { name: /git/i }).click();
  await page.getByRole('tab', { name: /^Files/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download project ZIP' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('browser-acceptance-project.zip');
  const archivePath = await download.path();
  expect(archivePath).toBeTruthy();
  const archive = unzipSync(new Uint8Array(await readFile(archivePath!)));
  expect(strFromU8(archive['src/main.js'])).toContain('saved across reload');
  expect(archive['.git/config']).toBeUndefined();

  await page.reload();
  await expect(createBlank).toHaveCount(0);
  await navigation.getByRole('button', { name: /git/i }).click();
  await page.getByRole('tab', { name: /^Files/ }).click();
  await page.getByRole('button', { name: 'src/main.js' }).click();
  await navigation.getByRole('button', { name: /code/i }).click();
  await expect(page.locator('.cm-content')).toContainText('saved across reload');
});
