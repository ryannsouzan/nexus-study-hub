import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { optimizeCover } from '../services/covers';
import { BookCover } from './BookCover';
import { errorMessage } from './UI';
export type CoverDraft = { url: string; id: string; upload?: Blob | null };
export function CoverFields({
  value,
  onChange,
  onBusyChange,
  title,
  error,
}: {
  value: CoverDraft;
  onChange: (value: CoverDraft) => void;
  onBusyChange: (busy: boolean) => void;
  title: string;
  error?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  return (
    <fieldset className="cover-fields full">
      <legend>Capa do livro</legend>
      <div className="cover-field-layout">
        <BookCover
          title={title || 'Livro'}
          coverId={value.id}
          coverUrl={value.url}
          preview={value.upload}
          eager
        />
        <div className="cover-field-controls">
          <label>
            URL da capa
            <input
              aria-label="URL da capa"
              type="url"
              value={value.url}
              placeholder="https://…"
              disabled={busy}
              onChange={(e) => {
                setFailure('');
                onChange({ url: e.target.value, id: '', upload: null });
              }}
            />
          </label>
          <p className="muted small">Ou envie uma imagem do seu dispositivo.</p>
          <label className={`button secondary upload-cover ${busy ? 'disabled' : ''}`}>
            <Upload size={16} />
            {busy ? 'Otimizando imagem…' : 'Enviar imagem'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Enviar imagem da capa"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setBusy(true);
                onBusyChange(true);
                setFailure('');
                try {
                  const blob = await optimizeCover(file);
                  onChange({ url: '', id: '', upload: blob });
                } catch (error) {
                  setFailure(errorMessage(error));
                } finally {
                  setBusy(false);
                  onBusyChange(false);
                }
              }}
            />
          </label>
          <button
            type="button"
            className="text-button"
            disabled={busy || !(value.id || value.url || value.upload)}
            onClick={() => {
              setFailure('');
              onChange({ id: '', url: '', upload: null });
            }}
          >
            <X size={14} />
            Remover capa
          </button>
          <p className="cover-help">
            PNG, JPEG ou WebP · até 5 MB. Otimizada para até 800 × 1200 px, sem distorção. Capas por
            URL precisam de internet e não são incorporadas ao backup.
          </p>
        </div>
      </div>
      {(failure || error) && (
        <p className="field-error" role="alert">
          {failure || error}
        </p>
      )}
      {busy && (
        <p className="small muted" role="status">
          Preparando sua capa. Aguarde antes de salvar.
        </p>
      )}
    </fieldset>
  );
}
