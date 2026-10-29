import { expect, test } from '@playwright/test';
import { selectPanel } from './navigation';

test('search and add a model from the installed WebLLM registry', async ({ page }) => {
  await page.goto('/');
  const createBlank = page.getByRole('button', { name: 'Create blank project' });
  await expect(createBlank).toBeVisible();
  await createBlank.click();
  await page.getByLabel('Project name').fill('Model library acceptance project');
  await page.getByRole('button', { name: 'Create project' }).click();

  await selectPanel(page, 'AI');
  await page.getByRole('button', { name: 'AI provider and model settings' }).click();

  const search = page.getByLabel('Search model IDs');
  await search.fill('Llama-3.2-1B-Instruct-q4f16_1-MLC');
  const result = page.getByRole('listitem').filter({ hasText: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' });
  await expect(result).toBeVisible({ timeout: 20_000 });
  await result.getByRole('button', { name: 'Add & select' }).click();

  await expect(page.getByRole('combobox', { name: 'AI model' }))
    .toHaveValue('Llama-3.2-1B-Instruct-q4f16_1-MLC');
  await page.getByText('Compatibility, download & storage details', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Local model download and cache' }))
    .toContainText('Local models use the pinned WebLLM registry or compatible Transformers.js ONNX repositories');
  await expect(page.getByRole('button', { name: 'Download & load model' })).toBeVisible();

  await page.getByRole('button', { name: 'AI provider and model settings' }).click();
  await expect(page.getByText('The repository must be public and contain ONNX model artifacts', { exact: false })).toBeVisible();
  await page.getByLabel('Hugging Face owner/model').fill('onnx-community/Qwen2.5-Coder-0.5B-Instruct');
  await page.getByRole('button', { name: 'Add compatible HF model' }).click();
  await expect(page.getByRole('combobox', { name: 'AI model' }))
    .toHaveValue('transformers:onnx-community/Qwen2.5-Coder-0.5B-Instruct');
});
