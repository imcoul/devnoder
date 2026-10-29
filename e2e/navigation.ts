import { expect, type Page } from '@playwright/test';

export async function selectPanel(page: Page, label: string) {
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation).toBeVisible({ timeout: 15_000 });
  const primary = navigation.getByRole('button', { name: label, exact: true });
  if (['Code', 'AI', 'Preview', 'Git'].includes(label)) {
    await expect(primary).toBeVisible();
    await primary.click();
    return;
  }

  const more = navigation.getByRole('button', { name: 'More', exact: true });
  await expect(more).toBeVisible();
  await more.click();
  const drawer = page.getByRole('dialog', { name: 'More tools' });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: label, exact: true }).click();
}
