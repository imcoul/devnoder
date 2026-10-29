import { expect, test } from '@playwright/test';
import { selectPanel } from './navigation';

test('commit identity is per-user and configured before local commits', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Create blank project/ }).click();
  await page.getByLabel('Project name').fill('Git author acceptance project');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();

  await selectPanel(page, 'Git');
  await page.getByRole('tab', { name: /^Files/ }).click();
  await page.getByRole('button', { name: '+ New file' }).click();
  await page.getByRole('textbox', { name: 'Project-relative file path' }).fill('hello.js');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.getByRole('tab', { name: /^Changes/ }).click();

  await expect(page.getByText('Required before commit or pull', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set identity to commit' })).toBeDisabled();
  await expect(page.locator('.git-author-box')).not.toContainText('dev@srvel.io');

  const name = page.getByRole('textbox', { name: 'Git commit author name' });
  const email = page.getByRole('textbox', { name: 'Git commit author email' });
  await name.fill('Browser Test Author');
  await expect(name).toHaveValue('Browser Test Author');
  await email.fill('browser-test@example.com');
  await expect(email).toHaveValue('browser-test@example.com');
  await page.getByRole('button', { name: 'Save commit identity' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'This repository will attribute commits to Browser Test Author' })).toBeVisible();

  await page.getByRole('button', { name: 'Stage all' }).click();
  const commitTab = page.getByRole('tab', { name: /^Changes/ });
  await expect(commitTab).toContainText('(1)', { timeout: 10_000 });
  await page.getByRole('textbox', { name: 'Commit message' }).fill('test: verify user-owned commit identity');
  await page.getByRole('button', { name: 'Commit (1)' }).click();
  await page.getByRole('tab', { name: 'Log', exact: true }).click();
  await expect(page.getByText('Browser Test Author', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.git-log-meta')).not.toContainText('dev@srvel.io');
});
