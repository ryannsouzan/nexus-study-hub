import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function panel(page: Page) {
  return page.locator('.learning-stage-panel');
}
async function selectStage(page: Page, title: string) {
  await page.locator('.stage-select').getByText(title, { exact: true }).click();
  await expect(
    (await panel(page)).getByRole('heading', { name: title, exact: true }),
  ).toBeVisible();
}
async function createStage(page: Page, title: string) {
  await page.getByRole('button', { name: 'Nova etapa', exact: true }).click();
  await page.getByLabel('Título da etapa', { exact: true }).fill(title);
  await page
    .getByLabel('Objetivos de aprendizagem (um por linha)')
    .fill(`Explicar ${title}\nAplicar em um experimento`);
  await page.getByRole('button', { name: 'Criar etapa', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function createCriterion(page: Page, title: string, type = 'manual', target?: string) {
  await page.getByRole('button', { name: 'Novo critério', exact: true }).click();
  await page.getByLabel('Título do critério', { exact: true }).fill(title);
  await page.getByLabel('Tipo de critério', { exact: true }).selectOption(type);
  if (target)
    await page
      .getByLabel(type === 'task' ? 'Tarefa do critério' : 'Tópico do critério', { exact: true })
      .selectOption({ label: target });
  await page.getByRole('button', { name: 'Criar critério', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function capture(page: Page, path: string) {
  const close = page.getByRole('button', { name: 'Fechar aviso', exact: true });
  if (await close.count()) await close.click();
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
}
test('DoE: quatro etapas, critérios reais, bloqueios, tarefas, roadmap, backup e reabertura', async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/trilhas');
  await expect(page.locator('.path-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nova trilha', exact: true }).click();
  await page.getByLabel('Título da trilha', { exact: true }).fill('Aprender Design of Experiments');
  await page
    .getByLabel('Objetivo da trilha')
    .fill('Planejar e interpretar experimentos analíticos.');
  await page.getByLabel('Área da trilha').selectOption({ label: 'Desenvolvimento Analítico' });
  await page
    .getByLabel('Projeto da trilha')
    .selectOption({ label: 'Estudar Design of Experiments' });
  await page.getByLabel('Status da trilha').selectOption('active');
  await page.getByRole('button', { name: 'Criar trilha', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Aprender Design of Experiments', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Aprender Design of Experiments', exact: true }),
  ).toBeVisible();
  const pathUrl = new URL(page.url()).pathname;
  for (const title of ['Estatística', 'Planejamento Fatorial', 'ANOVA', 'RSM'])
    await createStage(page, title);
  for (const [title, prerequisite] of [
    ['Planejamento Fatorial', 'Estatística'],
    ['ANOVA', 'Planejamento Fatorial'],
    ['RSM', 'ANOVA'],
  ]) {
    await selectStage(page, title);
    await page
      .getByLabel('Adicionar pré-requisito', { exact: true })
      .selectOption({ label: prerequisite });
    await page.getByRole('button', { name: 'Adicionar pré-requisito', exact: true }).click();
    await expect(
      (await panel(page)).getByText('Bloqueada por pré-requisitos', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Concluir etapa', exact: true })).toBeDisabled();
  }
  await selectStage(page, 'Estatística');
  expect(
    await page.getByLabel('Adicionar pré-requisito', { exact: true }).locator('option').count(),
  ).toBe(1);
  await createCriterion(page, 'Aplicar Estatística', 'evidence');
  await selectStage(page, 'Planejamento Fatorial');
  await page.getByRole('button', { name: 'Nova tarefa na etapa', exact: true }).click();
  await page.getByLabel('Título *', { exact: true }).fill('Resolver planejamento fatorial');
  await page.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await createCriterion(
    page,
    'Concluir prática fatorial',
    'task',
    'Resolver planejamento fatorial',
  );
  await selectStage(page, 'ANOVA');
  await page.getByRole('button', { name: 'Novo tópico', exact: true }).click();
  await page.getByLabel('Título do tópico', { exact: true }).fill('Interpretar ANOVA');
  await page.getByRole('button', { name: 'Criar tópico', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await createCriterion(page, 'Autoavaliar ANOVA', 'topic', 'Interpretar ANOVA');
  await page
    .getByLabel('Recurso da etapa', { exact: true })
    .selectOption({ label: 'Planejamento experimental e estatística' });
  await page.getByRole('button', { name: 'Vincular material', exact: true }).click();
  await expect(
    (await panel(page)).getByRole('link', {
      name: 'Planejamento experimental e estatística',
      exact: true,
    }),
  ).toBeVisible();
  await selectStage(page, 'RSM');
  await createCriterion(page, 'Validar RSM');
  await selectStage(page, 'Estatística');
  await capture(page, '/tmp/nexus-learning-list.png');
  await page
    .getByLabel('Evidência: Aplicar Estatística', { exact: true })
    .fill('Realizei a análise de um experimento e interpretei a variabilidade observada.');
  await page.getByRole('button', { name: 'Salvar evidência', exact: true }).click();
  await expect((await panel(page)).getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await page.getByRole('button', { name: 'Concluir etapa', exact: true }).click();
  await selectStage(page, 'Planejamento Fatorial');
  await expect((await panel(page)).getByText('Disponível', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Em andamento', exact: true }).click();
  await page.getByRole('button', { name: 'Roadmap', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  await page.getByRole('button', { name: 'Abrir etapa ANOVA', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    (await panel(page)).getByRole('heading', { name: 'ANOVA', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ampliar roadmap' }).click();
  await page.getByRole('button', { name: 'Centralizar roadmap' }).click();
  await capture(page, '/tmp/nexus-learning-roadmap.png');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Roadmap', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  await page.goto('/tarefas');
  await page.getByLabel('Pesquisar tarefas').fill('Resolver planejamento fatorial');
  await expect(page.locator('.task-row')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Concluir Resolver planejamento fatorial', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Reabrir Resolver planejamento fatorial', exact: true }),
  ).toBeVisible();
  await page.goto(pathUrl);
  await page.getByRole('button', { name: 'Lista estruturada', exact: true }).click();
  await selectStage(page, 'Planejamento Fatorial');
  await expect((await panel(page)).getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await page.getByRole('button', { name: 'Concluir etapa', exact: true }).click();
  await selectStage(page, 'ANOVA');
  await page.getByLabel('Autoavaliação de Interpretar ANOVA').selectOption('mastered');
  await expect((await panel(page)).getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await page.getByRole('button', { name: 'Concluir etapa', exact: true }).click();
  await selectStage(page, 'RSM');
  await page.getByLabel('Avaliação atendida: Validar RSM').check();
  await page.getByRole('button', { name: 'Concluir etapa', exact: true }).click();
  await expect(page.locator('.learning-path-summary').getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await page.getByRole('button', { name: 'Por progresso', exact: true }).click();
  await capture(page, '/tmp/nexus-learning-progress.png');
  await page.getByRole('button', { name: 'Editar trilha', exact: true }).click();
  await page.getByLabel('Status da trilha').selectOption('completed');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.learning-path-summary')).toContainText('Concluída');
  await page.goto('/configuracoes');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup', exact: true }).click();
  const file = await downloadPromise;
  const filePath = (await file.path())!;
  const backup = JSON.parse(await readFile(filePath, 'utf8'));
  expect(backup.schemaVersion).toBe(3);
  expect(backup.learningPaths).toHaveLength(1);
  expect(backup.learningStages).toHaveLength(4);
  expect(backup.learningDependencies).toHaveLength(3);
  expect(backup.learningStageResources).toHaveLength(1);
  expect(backup.learningStageTasks).toHaveLength(1);
  expect(backup.learningCriteria).toHaveLength(4);
  expect(backup.resources).toHaveLength(5);
  await page.goto('/tarefas');
  await page.getByLabel('Pesquisar tarefas').fill('Resolver planejamento fatorial');
  await page
    .getByRole('button', { name: 'Reabrir Resolver planejamento fatorial', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Concluir Resolver planejamento fatorial', exact: true }),
  ).toBeVisible();
  await page.goto(pathUrl);
  await expect(page.locator('.learning-path-summary')).toContainText('Ativa');
  await page.getByRole('button', { name: 'Lista estruturada', exact: true }).click();
  await selectStage(page, 'ANOVA');
  await expect(
    (await panel(page)).getByText('Bloqueada por pré-requisitos', { exact: true }),
  ).toBeVisible();
  await page.goto('/configuracoes');
  await page.getByLabel('Arquivo de backup').setInputFiles(filePath);
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(pathUrl);
  await expect(page.locator('.learning-path-summary')).toContainText('Concluída');
  await page.getByRole('button', { name: 'Roadmap', exact: true }).click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  await page.getByRole('button', { name: 'Abrir etapa ANOVA', exact: true }).click();
  await expect(
    (await panel(page)).getByRole('link', {
      name: 'Planejamento experimental e estatística',
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('exemplos opt-in, filtros, ordenação, exclusão segura e mobile', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/trilhas');
  await expect(page.locator('.path-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Carregar trilhas de exemplo' }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.path-card')).toHaveCount(3);
  await page
    .getByLabel('Filtrar trilhas por área')
    .selectOption({ label: 'Desenvolvimento Analítico' });
  await expect(page.locator('.path-card')).toHaveCount(2);
  await page.getByLabel('Filtrar trilhas por área').selectOption('');
  await page.getByLabel('Pesquisar trilhas').fill('Python');
  await expect(page.locator('.path-card')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Arquivar Python para dados científicos', exact: true })
    .click();
  await expect(page.locator('.path-card')).toContainText('Arquivada');
  await page.getByLabel('Filtrar trilhas por status').selectOption('planned');
  await expect(page.locator('.path-card')).toHaveCount(0);
  await page.getByLabel('Filtrar trilhas por status').selectOption('');
  await page.getByLabel('Pesquisar trilhas').fill('');
  await page.getByRole('link', { name: 'Design of Experiments', exact: true }).click();
  await page
    .getByRole('button', { name: 'Mover Fundamentos de estatística para baixo', exact: true })
    .click();
  await expect(page.locator('.stage-list-item').first()).toContainText(
    'Planejamento fatorial completo',
  );
  await selectStage(page, 'Planejamento fatorial completo');
  await page.getByRole('button', { name: 'Excluir etapa selecionada' }).click();
  await expect(page.getByRole('dialog')).toContainText('dependência(s) de saída');
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.stage-list-item')).toHaveCount(6);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelector('.sidebar')!.getBoundingClientRect().right <= 0,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, '/tmp/nexus-learning-mobile.png');
  await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Remover dados de exemplo' }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/trilhas');
  await expect(page.locator('.path-card')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.path-card')).toHaveCount(0);
});
