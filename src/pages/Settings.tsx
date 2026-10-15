import { useRef, useState } from 'react';
import { Download, Upload, Sun, Moon, ShieldCheck, Trash2, Info } from 'lucide-react';
import { PageHeader, ConfirmDialog, errorMessage, useNotice } from '../components/UI';
import { exportBackup, importBackup, validateBackup, removeExamples } from '../services/repository';
import type { Backup } from '../models/schema';
import { localDate } from '../services/calculations';
export function Settings({
  theme,
  setTheme,
}: {
  theme: 'light' | 'dark';
  setTheme: (v: 'light' | 'dark') => void;
}) {
  const notify = useNotice();
  const input = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const data = await exportBackup();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexus-backup-${localDate()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Backup exportado. Guarde o arquivo em um local seguro.');
    } catch (e) {
      notify(errorMessage(e), true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="SISTEMA"
        title="Configurações"
        description="Seu espaço, do seu jeito. Cuide também dos seus dados."
      />
      <div className="settings-stack">
        <section className="panel settings-section">
          <div className="settings-title">
            <Sun size={21} />
            <div>
              <h2>Aparência</h2>
              <p>Escolha o ambiente mais confortável para estudar.</p>
            </div>
          </div>
          <div className="theme-options">
            <button
              className={`theme-option ${theme === 'light' ? 'selected' : ''}`}
              aria-pressed={theme === 'light'}
              onClick={() => setTheme('light')}
            >
              <Sun size={22} />
              <span>Modo claro</span>
              <small>Leve e acolhedor</small>
            </button>
            <button
              className={`theme-option ${theme === 'dark' ? 'selected' : ''}`}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme('dark')}
            >
              <Moon size={22} />
              <span>Modo escuro</span>
              <small>Foco e tranquilidade</small>
            </button>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="settings-title">
            <ShieldCheck size={21} />
            <div>
              <h2>Seus dados e backups</h2>
              <p>Exporte seu espaço completo ou restaure um backup.</p>
            </div>
          </div>
          <div className="info-box">
            <Info size={19} />
            <p>
              Os dados ficam apenas neste navegador e dispositivo. Limpar os dados do site, usar uma
              janela anônima ou trocar de navegador pode fazer você perder o acesso aos registros.
              Exporte backups regularmente. O arquivo contém suas informações pessoais: guarde-o com
              cuidado.
            </p>
          </div>
          <div className="backup-actions">
            <button className="button primary" onClick={download} disabled={busy}>
              <Download size={17} />
              {busy ? 'Exportando…' : 'Exportar backup'}
            </button>
            <button className="button secondary" onClick={() => input.current?.click()}>
              <Upload size={17} />
              Importar backup
            </button>
            <input
              ref={input}
              type="file"
              accept="application/json,.json"
              aria-label="Arquivo de backup"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  if (file.size > 100 * 1024 * 1024)
                    throw new Error('O arquivo deve ter no máximo 100 MB.');
                  setBackup(validateBackup(JSON.parse(await file.text())));
                } catch (error) {
                  notify(
                    error instanceof SyntaxError
                      ? 'O arquivo não contém JSON válido. Nenhum dado foi alterado.'
                      : errorMessage(error),
                    true,
                  );
                }
              }}
            />
          </div>
          <p className="small muted">
            Formato JSON · Esquema versão 2 · Áreas, projetos, tarefas, biblioteca, competências e
            histórico e capas locais. URLs externas são preservadas como links, sem incorporar as
            imagens. Backups da versão 1 continuam aceitos.
          </p>
        </section>
        <section className="panel settings-section">
          <div className="settings-title">
            <Trash2 size={21} />
            <div>
              <h2>Dados demonstrativos</h2>
              <p>Remova os exemplos e preserve os registros que você criou.</p>
            </div>
          </div>
          <button className="button secondary danger-text" onClick={() => setRemoving(true)}>
            Remover dados de exemplo
          </button>
          <p className="small muted">
            Registros criados por você serão preservados, mesmo quando vinculados a exemplos.
            Vínculos com os exemplos removidos serão desfeitos.
          </p>
        </section>
        <section className="panel settings-section about">
          <span className="eyebrow">NEXUS · VERSÃO 0.1.1</span>
          <h2>Um lugar para conectar o que você aprende.</h2>
          <p>
            MVP local de estudos, projetos e conhecimento. Sem contas, sem serviços externos e sem
            sincronização entre dispositivos.
          </p>
        </section>
      </div>
      {backup && (
        <ConfirmDialog
          title="Substituir todos os dados?"
          description={`Este backup contém ${backup.areas.length} áreas, ${backup.projects.length} projetos, ${backup.tasks.length} tarefas e ${backup.resources.length} recursos. Todos os dados atuais serão substituídos. Exporte um backup antes de continuar.`}
          onClose={() => setBackup(null)}
          onConfirm={async () => {
            await importBackup(backup);
            notify('Backup restaurado com sucesso.');
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Remover os exemplos?"
          description="Somente registros marcados como Exemplo serão removidos. Seus registros independentes serão preservados e desvinculados dos exemplos."
          onClose={() => setRemoving(false)}
          onConfirm={async () => {
            await removeExamples();
            notify('Dados demonstrativos removidos.');
          }}
        />
      )}
    </>
  );
}
