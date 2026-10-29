import { expect, test } from '@playwright/test';
import { selectPanel } from './navigation';

test('GitHub remote and encrypted token survive reload and disconnect cleanly', async ({ page }) => {
  await page.route('https://api.github.com/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/user') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ login: 'test-user', name: 'Test User', avatar_url: '' }) });
    } else if (/\/repos\/owner\/repo\/(pulls|issues)$/.test(url.pathname)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    } else if (url.pathname === '/repos/owner/repo/actions/runs') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ workflow_runs: [] }) });
    } else {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not found' }) });
    }
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Create blank project' })).toBeVisible();
  await page.getByRole('button', { name: 'Create blank project' }).click();
  await page.getByLabel('Project name').fill('GitHub token acceptance');
  await page.getByRole('button', { name: 'Create project' }).click();

  await selectPanel(page, 'Git');
  await page.getByLabel('HTTPS or SSH GitHub repository URL').fill('https://github.com/owner/repo.git');
  await page.getByRole('button', { name: 'Save origin' }).click();
  await expect(page.getByText('https://github.com/owner/repo.git')).toBeVisible();

  await page.getByRole('tab', { name: /^PRs/ }).click();
  await page.getByLabel('GitHub personal access token').fill('test-fine-grained-token');
  await page.getByRole('button', { name: 'Connect with token' }).click();
  await expect(page.getByText('GitHub connected')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('devnoder-gh-token-encrypted-v1'))).toBeTruthy();
  expect(await page.evaluate(() => localStorage.getItem('devnoder-gh-token'))).toBeNull();

  await page.reload();
  await selectPanel(page, 'Git');
  await page.getByRole('tab', { name: /^PRs/ }).click();
  await expect(page.getByText('GitHub connected')).toBeVisible();
  await expect(page.getByText('No open pull requests')).toBeVisible();

  await page.getByRole('button', { name: 'Disconnect' }).click();
  await expect(page.getByLabel('GitHub personal access token')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('devnoder-gh-token-encrypted-v1'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('devnoder-gh-token'))).toBeNull();
});
