import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function capture(page: Page, path: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (img) => img.decode().catch(() => undefined)));
  });
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
}
async function illustratedCover(
  page: Page,
  color = '#436b55',
  title = 'ESTATÍSTICA',
  subtitle = 'Planejamento e descoberta',
) {
  return Buffer.from(
    await page.evaluate(
      ({ color, title, subtitle }) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 2400;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1600, 2400);
        ctx.fillStyle = '#ffffff0d';
        ctx.fillRect(70, 0, 8, 2400);
        ctx.strokeStyle = '#ffffff60';
        ctx.lineWidth = 3;
        ctx.strokeRect(130, 130, 1340, 2140);
        ctx.fillStyle = '#f5f1e6';
        ctx.font = '28px sans-serif';
        ctx.fillText('NEXUS / ACERVO DE EXEMPLO', 200, 260);
        ctx.font = 'bold 95px serif';
        title.split('|').forEach((line, i) => ctx.fillText(line, 200, 720 + i * 120));
        ctx.font = '36px sans-serif';
        ctx.fillText(subtitle, 200, 1080);
        ctx.beginPath();
        ctx.arc(800, 1620, 280, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(800, 1620, 180, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = '30px sans-serif';
        ctx.fillText('CAPA ILUSTRATIVA · TESTE NEXUS', 200, 2160);
        return Array.from(
          Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), (c) =>
            c.charCodeAt(0),
          ),
        );
      },
      { color, title, subtitle },
    ),
  );
}
async function storedCovers(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ id: string; mime: string; size: number; width: number; height: number }[]>(
        (resolve, reject) => {
          const request = indexedDB.open('nexus-study-hub');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction('covers', 'readonly');
            const read = tx.objectStore('covers').getAll();
            read.onsuccess = () =>
              resolve(
                read.result.map((c) => ({
                  id: c.id,
                  mime: c.blob.type,
                  size: c.blob.size,
                  width: c.width,
                  height: c.height,
                })),
              );
            read.onerror = () => reject(read.error);
            tx.oncomplete = () => db.close();
          };
        },
      ),
  );
}
async function clearExamples(page: Page) {
  await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Remover dados de exemplo' }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function upload(page: Page, buffer: Buffer, name = 'capa.png') {
  await page
    .getByLabel('Enviar imagem da capa')
    .setInputFiles({ name, mimeType: 'image/png', buffer });
}
async function saveCover(page: Page) {
  await expect(page.getByRole('button', { name: 'Salvar capa', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Salvar capa', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('capas reais: validação, otimização, troca, recarga, backup, restauração e remoção', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await clearExamples(page);
  await page.goto('/biblioteca');
  await page.getByRole('button', { name: 'Novo recurso', exact: true }).click();
  await page.getByLabel('Título *', { exact: true }).fill('Livro de teste com capa');
  await page.getByLabel('ISBN-10 ou ISBN-13', { exact: true }).fill('978-0-596-52068-7');
  await page.getByLabel('Subtítulo', { exact: true }).fill('Conhecimento conectado');
  await page.getByLabel('Editora', { exact: true }).fill('Editora de teste');
  await page.getByLabel('Edição', { exact: true }).fill('2ª edição');
  await page.getByLabel('Ano de publicação', { exact: true }).fill('2024');
  await page.getByLabel('Total de páginas', { exact: true }).fill('500');
  await page.getByLabel('Página atual', { exact: true }).fill('150');
  await page.getByRole('button', { name: 'Criar recurso', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Livro de teste com capa', exact: true }).click();
  await expect(page.getByText('Sem capa', { exact: true })).toBeVisible();
  await expect(page.getByText('978-0-596-52068-7', { exact: true })).toBeVisible();
  const bookPath = new URL(page.url()).pathname;
  await page.getByRole('button', { name: 'Adicionar capa' }).click();
  await page.getByLabel('Enviar imagem da capa').setInputFiles({
    name: 'invalido.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('invalid'),
  });
  await expect(page.getByRole('dialog')).toContainText('Escolha uma imagem PNG, JPEG ou WebP.');
  await upload(page, Buffer.alloc(5 * 1024 * 1024 + 1));
  await expect(page.getByRole('dialog')).toContainText('no máximo 5 MB');
  const corrupt = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(64)]);
  await upload(page, corrupt);
  await expect(page.getByRole('dialog')).toContainText('corrompida');
  const cover = await illustratedCover(page);
  await upload(page, cover);
  await expect(page.getByRole('dialog').locator('img.loaded')).toBeVisible();
  await saveCover(page);
  let covers = await storedCovers(page);
  expect(covers).toHaveLength(1);
  expect(covers[0]).toMatchObject({ mime: 'image/webp', width: 800, height: 1200 });
  expect(covers[0].size).toBeLessThan(cover.length);
  const original = covers[0].id;
  await page.reload();
  await expect(page.getByAltText('Capa de Livro de teste com capa')).toBeVisible();
  expect(
    await page
      .getByAltText('Capa de Livro de teste com capa')
      .evaluate((img) => getComputedStyle(img).objectFit),
  ).toBe('contain');
  await page.getByRole('button', { name: 'Substituir capa' }).click();
  await upload(page, await illustratedCover(page, '#536a92', 'PESQUISA', 'Uma nova perspectiva'));
  await expect(page.getByRole('dialog').locator('img.loaded')).toBeVisible();
  await saveCover(page);
  covers = await storedCovers(page);
  expect(covers).toHaveLength(1);
  expect(covers[0].id).not.toBe(original);
  await page.getByLabel('Página atual de leitura').fill('200');
  await page.getByRole('button', { name: 'Atualizar leitura' }).click();
  await expect(page.getByRole('progressbar', { name: '200 de 500 páginas' })).toHaveAttribute(
    'aria-valuenow',
    '40',
  );
  await page.getByLabel('Página atual de leitura').fill('501');
  await page.getByRole('button', { name: 'Atualizar leitura' }).click();
  await expect(page.getByRole('alert')).toContainText('entre 0 e 500');
  await page.goto('/configuracoes');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup' }).click();
  const download = await downloadPromise;
  const backupPath = (await download.path())!;
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(backup.schemaVersion).toBe(3);
  expect(backup.covers).toHaveLength(1);
  expect(backup.covers[0].data.length).toBeGreaterThan(100);
  expect(backup.resources[0].isbnNormalized).toBe('9780596520687');
  await page.goto(bookPath);
  await page.getByRole('button', { name: 'Remover capa', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await storedCovers(page)).toHaveLength(0);
  await expect(page.getByText('Sem capa', { exact: true })).toBeVisible();
  await page.goto('/configuracoes');
  await page.getByLabel('Arquivo de backup').setInputFiles(backupPath);
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(bookPath);
  await expect(page.getByAltText('Capa de Livro de teste com capa')).toBeVisible();
  expect((await storedCovers(page))[0].id).toBe(covers[0].id);
  await expect(page.getByRole('progressbar', { name: '200 de 500 páginas' })).toHaveAttribute(
    'aria-valuenow',
    '40',
  );
  await page.route('https://covers.example.test/test.png', (route) =>
    route.fulfill({ contentType: 'image/png', body: cover }),
  );
  await page.getByRole('button', { name: 'Substituir capa' }).click();
  await page
    .getByLabel('URL da capa', { exact: true })
    .fill('https://covers.example.test/test.png');
  await saveCover(page);
  await expect(page.getByAltText('Capa de Livro de teste com capa')).toHaveAttribute(
    'src',
    'https://covers.example.test/test.png',
  );
  expect(await storedCovers(page)).toHaveLength(0);
  await page.getByRole('button', { name: 'Remover capa', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Sem capa', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('estante/lista persistentes, filtros, capas indisponíveis e capturas responsivas', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/configuracoes');
  const palette = ['#436b55', '#536a92', '#8c7552', '#685c7a', '#4f7777', '#765c50'];
  const titles = [
    'Design of|Experiments',
    'Python para|análise de dados',
    'Química|Analítica',
    'Pesquisa|Científica',
    'Cromatografia|Líquida',
    'Estatística|Aplicada',
  ];
  for (let i = 0; i < 6; i++) {
    const cover = await illustratedCover(page, palette[i], titles[i], 'Referência demonstrativa');
    await page.route(`https://covers.example.test/${i}.png`, (route) =>
      route.fulfill({ contentType: 'image/png', body: cover }),
    );
  }
  const now = new Date().toISOString();
  const meta = { createdAt: now, updatedAt: now, example: true };
  const base = {
    author: 'Referência de exemplo',
    type: 'livro',
    description: 'Material demonstrativo para revisar a experiência de navegação.',
    url: '',
    areaId: 'a',
    projectIds: ['p'],
    tags: ['exemplo'],
    status: 'desejo',
    totalPages: 500,
    currentPage: 0,
    doi: '',
    journal: '',
    year: 0,
    platform: '',
    totalLessons: 0,
    completedLessons: 0,
    ...meta,
  };
  const books = titles.map((title, i) => ({
    ...base,
    id: `b${i}`,
    title: title.replace('|', ' '),
    subtitle: 'Referência demonstrativa',
    coverUrl: `https://covers.example.test/${i}.png`,
    author: i === 0 ? 'Douglas C. Montgomery' : 'Autor de exemplo',
    status: i === 0 ? 'andamento' : 'desejo',
  }));
  const backup = {
    schemaVersion: 1,
    exportedAt: now,
    areas: [
      {
        id: 'a',
        name: 'Desenvolvimento Analítico',
        description: '',
        color: '#436b55',
        icon: 'flask',
        ...meta,
      },
    ],
    projects: [
      {
        id: 'p',
        name: 'Estudar DoE',
        description: '',
        objective: '',
        areaId: 'a',
        status: 'andamento',
        priority: 'media',
        startDate: '',
        deadline: '',
        ...meta,
      },
    ],
    tasks: [],
    resources: [...books, { ...base, id: 'course', title: 'Curso de Python', type: 'curso' }],
    competencies: [],
    activities: [],
  };
  await page.getByLabel('Arquivo de backup').setInputFiles({
    name: 'exemplos.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/biblioteca');
  await expect(page.locator('.book-card')).toHaveCount(6);
  await expect(page.locator('.resource-card')).toHaveCount(1);
  await expect(page.locator('.book-cover img.loaded')).toHaveCount(6);
  await capture(page, '/tmp/nexus-library-shelf.png');
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await expect(page.locator('.resource-list-row')).toHaveCount(7);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Lista', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await capture(page, '/tmp/nexus-library-list.png');
  await page.getByLabel('Pesquisar na biblioteca').fill('Montgomery');
  await expect(page.locator('.resource-list-row')).toHaveCount(1);
  await page.getByLabel('Pesquisar na biblioteca').fill('');
  await page.getByLabel('Filtrar recursos por tipo').selectOption('curso');
  await expect(page.locator('.resource-list-row')).toHaveCount(1);
  await page.getByLabel('Filtrar recursos por tipo').selectOption('');
  await page.getByLabel('Filtrar recursos por status').selectOption('andamento');
  await expect(page.locator('.resource-list-row')).toHaveCount(1);
  await page.getByLabel('Filtrar recursos por status').selectOption('');
  await page.getByRole('button', { name: 'Estante', exact: true }).click();
  await page.getByLabel('Ações de Design of Experiments', { exact: true }).click();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const card = page.locator('.book-card').first();
  const bounds = await card.boundingBox();
  await card.click({ position: { x: 8, y: bounds!.height - 4 } });
  await expect(
    page.getByRole('heading', { name: 'Design of Experiments', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Estudar DoE', exact: true })).toBeVisible();
  await capture(page, '/tmp/nexus-book-details.png');
  await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Modo escuro' }).click();
  await page.goto('/biblioteca');
  await expect(page.locator('.book-cover img.loaded')).toHaveCount(6);
  await capture(page, '/tmp/nexus-library-dark.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelector('.sidebar')!.getBoundingClientRect().right <= 0,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, '/tmp/nexus-library-mobile.png');
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/biblioteca/b0');
  await page.getByRole('button', { name: 'Substituir capa' }).click();
  await page.route('https://covers.example.test/broken.png', (route) =>
    route.fulfill({ status: 404, body: 'missing' }),
  );
  await page
    .getByLabel('URL da capa', { exact: true })
    .fill('https://covers.example.test/broken.png');
  await saveCover(page);
  await expect(page.getByText('Capa indisponível', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Design of Experiments', exact: true }),
  ).toBeVisible();
});
