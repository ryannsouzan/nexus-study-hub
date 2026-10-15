import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import Dexie from 'dexie';
import { db, NexusDatabase } from '../services/db';
import {
  saveResource,
  saveArea,
  saveProject,
  deleteEntity,
  exportBackup,
  importBackup,
  validateBackup,
  removeExamples,
} from '../services/repository';
import {
  blobBytes,
  base64ToBytes,
  bytesToBase64,
  optimizeCover,
  prepareCoverAsset,
  validateCoverFile,
} from '../services/covers';
import { isValidIsbn, normalizeIsbn } from '../models/books';
import { resourceProgress } from '../services/calculations';
import type { ResourceInput } from '../models/schema';
const fixture = readFileSync('e2e/fixtures/cover.png');
const other = readFileSync('e2e/fixtures/cover-replacement.png');
const image = () => new Blob([fixture], { type: 'image/png' });
const book: ResourceInput = {
  title: 'Livro sem capa',
  author: '',
  type: 'livro',
  description: '',
  url: '',
  areaId: '',
  projectIds: [],
  tags: [],
  status: 'andamento',
  totalPages: 500,
  currentPage: 150,
  doi: '',
  journal: '',
  year: 0,
  platform: '',
  totalLessons: 0,
  completedLessons: 0,
};
// jsdom has no image decoder. Browser tests exercise real decoding and canvas optimization.
const decode = vi.fn(async () => ({ width: 20, height: 30, close: vi.fn() }));
beforeAll(() => {
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('Blob', NodeBlob);
  vi.stubGlobal('createImageBitmap', decode);
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(async () => {
  decode.mockClear();
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
});
describe('Metadados, capas e integridade', () => {
  it('cria livro antigo sem capa e com URL opcional e valida ISBN', async () => {
    const id = await saveResource(book);
    expect(await db.resources.get(id)).toMatchObject({ coverId: '', coverUrl: '', isbn: '' });
    await saveResource(
      {
        ...book,
        coverUrl: 'https://example.com/capa.jpg',
        isbn: '978-0-596-52068-7',
        publisher: 'Editora',
        subtitle: 'Um subtítulo',
        edition: '2ª',
      },
      id,
    );
    expect(await db.resources.get(id)).toMatchObject({
      coverUrl: 'https://example.com/capa.jpg',
      isbn: '978-0-596-52068-7',
      isbnNormalized: '9780596520687',
    });
    expect(isValidIsbn('0-306-40615-2')).toBe(true);
    expect(isValidIsbn('0-8044-2957-x')).toBe(true);
    expect(normalizeIsbn('978 0 596 52068 7')).toBe('9780596520687');
    for (const isbn of ['123', '9780596520688', '0-306-40615-3'])
      await expect(saveResource({ ...book, isbn })).rejects.toThrow();
    await expect(saveResource({ ...book, coverUrl: 'javascript:alert(1)' })).rejects.toThrow();
    expect(await db.covers.count()).toBe(0);
  });
  it('armazena Blob e deduplica; preserva capa compartilhada e coleta após a última exclusão', async () => {
    const a = await saveResource(book, undefined, image());
    const b = await saveResource({ ...book, title: 'Segundo livro' }, undefined, image());
    const r = (await db.resources.get(a))!;
    expect((await db.resources.get(b))?.coverId).toBe(r.coverId);
    expect(await db.covers.count()).toBe(1);
    expect(await blobBytes((await db.covers.get(r.coverId!))!.blob)).toEqual(
      Uint8Array.from(fixture),
    );
    await deleteEntity('resource', a);
    expect(await db.covers.count()).toBe(1);
    await deleteEntity('resource', b);
    expect(await db.covers.count()).toBe(0);
  });
  it('substitui e remove a capa sem remover livro ou alterar seus vínculos/progresso', async () => {
    const area = await saveArea({ name: 'Área', description: '', color: '#436b55', icon: 'book' });
    const project = await saveProject({
      name: 'Projeto',
      description: '',
      objective: '',
      areaId: area,
      status: 'andamento',
      priority: 'media',
      startDate: '',
      deadline: '',
    });
    const id = await saveResource(
      { ...book, areaId: area, projectIds: [project] },
      undefined,
      image(),
    );
    const initial = (await db.resources.get(id))!;
    await saveResource(initial, id, new Blob([other], { type: 'image/png' }));
    const next = (await db.resources.get(id))!;
    expect(next.coverId).not.toBe(initial.coverId);
    expect(await db.covers.get(initial.coverId!)).toBeUndefined();
    expect(await db.covers.count()).toBe(1);
    await saveResource({ ...next, coverUrl: '' }, id, null);
    expect(await db.resources.get(id)).toMatchObject({
      coverId: '',
      areaId: area,
      projectIds: [project],
      currentPage: 150,
    });
    expect(await db.covers.count()).toBe(0);
    expect(resourceProgress((await db.resources.get(id))!)).toBe(30);
  });
  it('valida MIME, tamanho, conteúdo e falhas de decodificação', async () => {
    expect(() => validateCoverFile(new Blob(['abc'], { type: 'image/gif' }))).toThrow('PNG');
    expect(() =>
      validateCoverFile(new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' })),
    ).toThrow('5 MB');
    await expect(optimizeCover(new Blob(['not an image'], { type: 'image/png' }))).rejects.toThrow(
      'válida',
    );
    decode.mockRejectedValueOnce(new Error('decode'));
    await expect(prepareCoverAsset(image())).rejects.toThrow('corrompida');
    expect(await db.resources.count()).toBe(0);
  });
  it('reverte capa e livro juntos em uma falha de vínculo e limpa exemplos', async () => {
    await expect(
      saveResource({ ...book, projectIds: ['ausente'] }, undefined, image()),
    ).rejects.toThrow();
    expect(await db.covers.count()).toBe(0);
    const id = await saveResource(book, undefined, image());
    await db.resources.update(id, { example: true });
    await removeExamples();
    expect(await db.covers.count()).toBe(0);
  });
});
describe('Backup de capas', () => {
  it('exporta binário uma única vez e restaura Blob com metadados, IDs e associações', async () => {
    const id = await saveResource(book, undefined, image());
    await saveResource({ ...book, title: 'Outro' }, undefined, image());
    const backup = await exportBackup();
    expect(backup.schemaVersion).toBe(2);
    expect(backup.covers).toHaveLength(1);
    expect(base64ToBytes(backup.covers[0].data)).toEqual(Uint8Array.from(fixture));
    await deleteEntity('resource', id);
    await importBackup(JSON.parse(JSON.stringify(backup)));
    const restored = (await db.resources.get(id))!;
    expect(resourceProgress(restored)).toBe(30);
    expect(await blobBytes((await db.covers.get(restored.coverId!))!.blob)).toEqual(
      Uint8Array.from(fixture),
    );
    db.close();
    await db.open();
    expect(await db.covers.count()).toBe(1);
  });
  it('rejeita conteúdo adulterado, dimensões, referências e Base64 sem alterar o banco', async () => {
    const id = await saveResource(book, undefined, image());
    const backup = await exportBackup();
    const bad = [
      { ...backup, covers: [{ ...backup.covers[0], data: '***=' }] },
      { ...backup, covers: [] },
      { ...backup, covers: [...backup.covers, ...backup.covers] },
    ];
    for (const raw of bad) {
      expect(() => validateBackup(raw)).toThrow();
      expect(await db.resources.get(id)).toBeDefined();
    }
    for (const raw of [
      { ...backup, covers: [{ ...backup.covers[0], data: bytesToBase64(Uint8Array.from(other)) }] },
      { ...backup, covers: [{ ...backup.covers[0], width: 21 }] },
    ]) {
      await expect(importBackup(raw)).rejects.toThrow('integridade');
      expect((await db.resources.get(id))?.coverId).toBe(backup.resources[0].coverId);
    }
    expect(await db.covers.count()).toBe(1);
  });
  it('aceita backups v1 sem capas e preserva URL externa sem embutir imagem', async () => {
    const id = await saveResource({ ...book, coverUrl: 'https://example.com/book.png' });
    const backup = await exportBackup();
    expect(backup.covers).toEqual([]);
    const legacy = { ...backup, schemaVersion: 1 };
    await importBackup(legacy);
    expect(await db.resources.get(id)).toMatchObject({ coverUrl: 'https://example.com/book.png' });
  });
});
describe('Migração do IndexedDB', () => {
  it('abre banco da Fase 1 com livro e relacionamentos preservados', async () => {
    const name = `legacy-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(1).stores({
      areas: 'id, name',
      projects: 'id, areaId, status, updatedAt',
      tasks: 'id, projectId, status, deadline, completedAt',
      resources: 'id, areaId, type, status, *projectIds, *tags',
      competencies: 'id, *areaIds, *projectIds',
      activities: 'id, at, entityId',
      settings: 'key',
    });
    const now = new Date().toISOString();
    await old.table('resources').add({
      ...book,
      id: 'old-book',
      areaId: 'old-area',
      projectIds: ['old-project'],
      createdAt: now,
      updatedAt: now,
      example: false,
    });
    old.close();
    const current = new NexusDatabase(name);
    try {
      await current.open();
      expect(current.verno).toBe(2);
      expect(await current.resources.get('old-book')).toMatchObject({
        id: 'old-book',
        coverId: '',
        coverUrl: '',
        subtitle: '',
        isbn: '',
        areaId: 'old-area',
        projectIds: ['old-project'],
        currentPage: 150,
        totalPages: 500,
      });
      expect(await current.covers.count()).toBe(0);
    } finally {
      await current.delete();
    }
  });
});
