import { test, expect, type Page } from '@playwright/test';
async function removeExamples(page: Page) {
  await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Remover dados de exemplo' }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function createArea(page: Page, name = 'Desenvolvimento Analítico') {
  await page.goto('/areas');
  await page.getByRole('button', { name: 'Nova área', exact: true }).click();
  await page.getByLabel('Nome *', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Criar área', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function createProject(page: Page) {
  await page.goto('/projetos');
  await page.getByRole('button', { name: 'Novo projeto', exact: true }).click();
  await page.getByLabel('Nome *', { exact: true }).fill('Aprender DoE');
  await page
    .getByRole('combobox', { name: 'Área', exact: true })
    .selectOption({ label: 'Desenvolvimento Analítico' });
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('andamento');
  await page.getByRole('button', { name: 'Criar projeto', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Aprender DoE', exact: true }).click();
}
test('organização, biblioteca, persistência, backup e dashboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await removeExamples(page);
  await createArea(page);
  await createProject(page);
  for (let i = 1; i <= 5; i++) {
    await page.getByRole('button', { name: 'Nova tarefa', exact: true }).click();
    await page.getByLabel('Título *', { exact: true }).fill(`Tarefa DoE ${i}`);
    await page.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Concluir Tarefa DoE 1', exact: true }).click();
  await page.getByRole('button', { name: 'Concluir Tarefa DoE 2', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Progresso', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '40',
  );
  await page.getByRole('button', { name: 'Novo recurso', exact: true }).click();
  await page.getByLabel('Título *', { exact: true }).fill('Estatística experimental');
  await page.getByLabel('Total de páginas', { exact: true }).fill('500');
  await page.getByLabel('Página atual', { exact: true }).fill('150');
  await page.getByRole('button', { name: 'Criar recurso', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('progressbar', { name: '150 de 500 páginas' })).toHaveAttribute(
    'aria-valuenow',
    '30',
  );
  const projectPath = new URL(page.url()).pathname;
  await page.reload();
  await expect(page.getByRole('progressbar', { name: 'Progresso', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '40',
  );
  await expect(
    page.getByRole('link', { name: 'Estatística experimental', exact: true }),
  ).toBeVisible();
  await page.goto('/configuracoes');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup' }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.goto(projectPath);
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Nome *', { exact: true }).fill('Nome alterado');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByRole('heading', { name: 'Nome alterado', exact: true })).toBeVisible();
  await page.goto('/configuracoes');
  await page.getByLabel('Arquivo de backup').setInputFiles(path!);
  await expect(page.getByRole('dialog')).toContainText('5 tarefas');
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(projectPath);
  await expect(page.getByRole('heading', { name: 'Aprender DoE', exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Progresso', exact: true })).toHaveAttribute(
    'aria-valuenow',
    '40',
  );
  await page.getByRole('link', { name: 'Estatística experimental', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Estatística experimental', exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.project-card').getByRole('link', { name: 'Aprender DoE', exact: true }),
  ).toBeVisible();
  await page.goto('/');
  const stats = page.getByRole('region', { name: 'Indicadores' });
  await expect(stats).toContainText('Projetos ativos1');
  await expect(stats).toContainText('Tarefas pendentes3');
  await expect(stats).toContainText('Concluídas na semana2');
  await expect(page.locator('.chart-legend')).toContainText('Desenvolvimento Analítico');
  await expect(page.locator('.chart-legend strong')).toHaveText('1');
  await expect(page.locator('path.recharts-sector')).toHaveCount(1);
  await page.getByLabel('Busca global').fill('Estatística');
  await page
    .locator('.search-results')
    .getByRole('link', { name: 'Estatística experimental' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Estatística experimental', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('navegação, filtros, Kanban, tema e exclusão segura', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Seu conhecimento, conectado.' })).toBeVisible();
  for (const path of [
    '/hoje',
    '/areas',
    '/projetos',
    '/tarefas',
    '/biblioteca',
    '/configuracoes',
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Modo escuro' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Modo claro' }).click();
  await page.goto('/projetos');
  await page.getByRole('button', { name: 'Visualização Kanban' }).click();
  const status = page.getByLabel('Status de Aprender Pandas', { exact: true });
  await status.selectOption('concluido');
  await expect(
    page
      .locator('.kanban-column')
      .filter({ has: page.getByRole('heading', { name: /Concluído/ }) }),
  ).toContainText('Aprender Pandas');
  await page.getByRole('button', { name: 'Visualização em cards' }).click();
  await page.getByLabel('Filtrar projetos por status').selectOption('concluido');
  await expect(page.locator('.project-card')).toHaveCount(1);
  await page.getByLabel('Pesquisar projetos').fill('não existe');
  await expect(page.getByText('Nada por aqui ainda')).toBeVisible();
  await page.goto('/tarefas');
  await page.getByRole('button', { name: 'Hoje', exact: true }).click();
  await expect(page.locator('.task-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Concluídas', exact: true }).click();
  await expect(page.locator('.task-row')).toHaveCount(0);
  await page.goto('/areas');
  await page.getByRole('link', { name: 'Programação', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('preservados sem área');
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page).toHaveURL(/\/areas$/);
  await page.goto('/projetos');
  await page.getByRole('link', { name: 'Aprender Pandas', exact: true }).click();
  await expect(page.locator('dd').filter({ hasText: 'Sem área' })).toBeVisible();
  await page.goto('/configuracoes');
  await page.getByLabel('Arquivo de backup').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole('alert')).toContainText('Backup inválido');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('layout móvel e formulário acessível por teclado', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Seu conhecimento, conectado.' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await page.getByRole('link', { name: 'Áreas', exact: true }).click();
  await page.getByRole('button', { name: 'Nova área', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Nome *', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
