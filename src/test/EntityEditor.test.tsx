import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EntityEditor } from '../components/EntityEditor';
import { NoticeProvider } from '../components/UI';
import { db } from '../services/db';
const data = { areas: [], projects: [], tasks: [], resources: [], activities: [] };
describe('Formulário integrado', () => {
  it('mostra validação de nome obrigatório e salva uma área no IndexedDB', async () => {
    await db.areas.clear();
    const close = vi.fn();
    render(
      <NoticeProvider>
        <EntityEditor target={{ kind: 'area' }} data={data} onClose={close} />
      </NoticeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Criar área' }));
    expect(await screen.findByText('Informe um nome ou título.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Nome *'), {
      target: { value: 'Área criada pelo formulário' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar área' }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect((await db.areas.toArray()).some((a) => a.name === 'Área criada pelo formulário')).toBe(
      true,
    );
  });
  it('impede progresso acima do total no formulário de livro', async () => {
    render(
      <NoticeProvider>
        <EntityEditor target={{ kind: 'resource' }} data={data} onClose={() => {}} />
      </NoticeProvider>,
    );
    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Livro' } });
    fireEvent.change(screen.getByLabelText('Total de páginas'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Página atual'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar recurso' }));
    expect(await screen.findByText('A página atual não pode superar o total.')).toBeVisible();
  });
});
