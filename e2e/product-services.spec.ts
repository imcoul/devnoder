import { expect, test } from '@playwright/test';
import { selectPanel } from './navigation';

test('unavailable billing and Srvel attribution are explained without dead links', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Create blank project/ }).click();
  await page.getByLabel('Project name').fill('Product trust acceptance project');
  await page.getByRole('button', { name: 'Create project', exact: true }).click();

  await selectPanel(page, 'Settings');
  await page.getByRole('button', { name: 'Subscription', exact: true }).click();
  await expect(page.getByText('Billing is not available in this release', { exact: true })).toBeVisible();
  await expect(page.getByText('No purchase action is offered from this app.', { exact: false })).toBeVisible();
  await expect(page.locator('a[href="https://srvel.net"]')).toHaveCount(0);

  await page.goto('/about/');
  await expect(page.getByRole('heading', { name: 'About DevNoder' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Relationship to Srvel' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'srvel.net' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'public guide' })).toBeVisible();

  await page.goto('/');
  await selectPanel(page, 'Community');
  await page.getByRole('button', { name: /Compute/ }).click();
  await expect(page.getByText('Community compute is not configured', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start Contributing/ })).toHaveCount(0);
});
