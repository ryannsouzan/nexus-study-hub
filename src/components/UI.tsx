import { createContext, useContext, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Plus,
  Inbox,
  FlaskConical,
  Code2,
  BookOpen,
  Brain,
  Globe2,
  Leaf,
  Check,
  AlertCircle,
} from 'lucide-react';
export const areaIcons = {
  flask: FlaskConical,
  code: Code2,
  book: BookOpen,
  brain: Brain,
  globe: Globe2,
  leaf: Leaf,
};
const NoticeContext = createContext<(message: string, error?: boolean) => void>(() => {});
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const notify = (message: string, error = false) => setNotice({ message, error });
  return (
    <NoticeContext.Provider value={notify}>
      {children}
      {notice && (
        <div
          className={`toast ${notice.error ? 'error' : ''}`}
          role={notice.error ? 'alert' : 'status'}
        >
          {notice.error ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{notice.message}</span>
          <button aria-label="Fechar aviso" title="Fechar aviso" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </NoticeContext.Provider>
  );
}
export const useNotice = () => useContext(NoticeContext);
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Fechar">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const notify = useNotice();
  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={title}
      description={description}
    >
      <div className="modal-actions">
        <button className="button secondary" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } catch (e) {
              notify(errorMessage(e), true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Aguarde…' : 'Confirmar'}
        </button>
      </div>
    </Modal>
  );
}
export function errorMessage(error: unknown) {
  if (error instanceof Error && error.name === 'QuotaExceededError')
    return 'O armazenamento está cheio. Exporte um backup e libere espaço no navegador.';
  if (
    error instanceof Error &&
    ['SecurityError', 'InvalidStateError', 'OpenFailedError'].includes(error.name)
  )
    return 'Não foi possível acessar o armazenamento local. Verifique as permissões do navegador.';
  return error instanceof Error
    ? error.message
    : 'Não foi possível salvar os dados. Verifique o armazenamento do navegador e tente novamente.';
}
export function Empty({
  title = 'Nada por aqui ainda',
  description = 'Comece com um novo registro ou ajuste os filtros.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function NewButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="button primary" onClick={onClick}>
      <Plus size={17} />
      {children}
    </button>
  );
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Progress({ value, label = 'Progresso' }: { value: number | null; label?: string }) {
  return (
    <div className="progress-block">
      <div className="progress-label">
        <span>{value === null ? 'Sem tarefas' : label}</span>
        {value !== null && <strong>{value}%</strong>}
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}
export function Example({ value }: { value: boolean }) {
  return value ? <span className="example-badge">Exemplo</span> : null;
}
