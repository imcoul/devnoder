import { expect, test } from '@playwright/test';

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
