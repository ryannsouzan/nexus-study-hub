import { renderHook, waitFor } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { useObjectUrl } from '../hooks/useObjectUrl';
it('reutiliza a URL da mesma imagem e revoga URLs na troca e desmontagem', async () => {
  let next = 0;
  const create = vi.fn(() => `blob:test-${++next}`);
  const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
  try {
    const first = new Blob(['first']);
    const second = new Blob(['second']);
    const { result, rerender, unmount } = renderHook(({ blob }) => useObjectUrl(blob), {
      initialProps: { blob: first },
    });
    await waitFor(() => expect(result.current).toBe('blob:test-1'));
    rerender({ blob: first });
    expect(create).toHaveBeenCalledTimes(1);
    rerender({ blob: second });
    await waitFor(() => expect(result.current).toBe('blob:test-2'));
    expect(revoke).toHaveBeenCalledWith('blob:test-1');
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:test-2');
    expect(revoke).toHaveBeenCalledTimes(2);
  } finally {
    vi.unstubAllGlobals();
  }
});
