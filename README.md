# Nexus — Personal Knowledge & Learning Hub

Uma aplicação web em português brasileiro para organizar estudos, projetos, tarefas e referências. Esta primeira versão funciona no navegador, com dados persistidos em IndexedDB, sem conta ou API remota.

## Iniciar

Requisitos: **Node.js 22.12 ou superior** (também validado com Node 24) e npm.

```bash
npm ci
npm run dev
```

O Vite informa o endereço de desenvolvimento no terminal. No ambiente da nuvem, o servidor escuta na porta 5173 e em todas as interfaces. Nenhuma variável de ambiente, chave ou serviço externo é necessário. Caso o cache padrão do npm não seja gravável, use `npm ci --cache /tmp/nexus-npm-cache`.

```bash
npm run typecheck       # TypeScript
npm run test            # Vitest + Testing Library
npm run lint            # ESLint
npm run build           # compila TypeScript e gera dist/
npm run preview         # serve o build de produção
npm run format:check    # verifica formatação
```

Para testar a interface com Playwright:

```bash
npx playwright install chromium
npm run test:e2e
```

Em Linux, pode ser necessário instalar as dependências de sistema com `npx playwright install-deps chromium`, com privilégios administrativos. Se o Chromium já estiver instalado, é possível usar o executável existente sem baixar outro navegador:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

O Playwright inicia e encerra seu próprio servidor. Cada teste utiliza um contexto de navegador isolado, sem alterar os dados do navegador pessoal. Os traces de falhas ficam em `test-results/`, ignorado pelo Git.

## Funcionalidades

- Dashboard: projetos em andamento, indicadores, distribuição de projetos por área, próximos passos e atividade recente calculados a partir do banco local.
- Áreas: criação, edição, pesquisa, exclusão e detalhes com projetos e recursos associados; escolha de cor e ícone.
- Projetos: cards, Kanban com mudança de status, filtros por área/status/prioridade, objetivo, início, prazo e histórico. Tarefas e recursos podem ser criados, associados e desvinculados nos detalhes.
- Tarefas: criação, edição, exclusão, conclusão e reabertura, associação opcional, filtros por status/projeto, ordenação por prazo/prioridade e visualizações Todas, Hoje, Próximos 7 dias, Atrasadas e Concluídas.
- Biblioteca: sete tipos de materiais, autor, link, tags, área e vários projetos; páginas para livros, aulas para cursos e DOI/revista/ano para artigos.
- Busca global por nome/título, descrição, autor e tags, com resultados agrupados que abrem o registro.
- Configurações: tema claro/escuro persistido, exportação e importação JSON e remoção de exemplos.
- Layout responsivo, navegação sem recarregar a página, diálogos com foco e teclado, feedback e estados de carregamento, erro e vazio.

Os exemplos iniciais são explicitamente marcados como **Exemplo**, não registram conclusões ou horas fictícias e podem ser removidos. Alterar um exemplo mantém sua identificação; crie registros próprios se quiser preservá-los ao remover a demonstração. Os exemplos só são instalados na primeira inicialização do banco e não reaparecem depois de removidos.

## Arquitetura

| Local                          | Responsabilidade                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `src/models/schema.ts`         | Entidades, tipos e validações Zod, incluindo competências preparadas para uma fase futura |
| `src/services/db.ts`           | Dexie, esquema IndexedDB versão 1, tabelas e índices                                      |
| `src/services/repository.ts`   | CRUD, transações, integridade, histórico, backup e remoção de exemplos                    |
| `src/services/calculations.ts` | Progresso, indicadores, filtros, busca e datas locais                                     |
| `src/services/seed.ts`         | Inicialização idempotente dos dados demonstrativos                                        |
| `src/hooks/`                   | Consultas reativas, contexto da aplicação e tema                                          |
| `src/components/`              | Layout, busca, formulários, cards, diálogos e feedback                                    |
| `src/pages/`                   | Dashboard, coleções, detalhes e configurações                                             |
| `src/test/`                    | Testes de regras de negócio, banco e formulários                                          |
| `e2e/`                         | Fluxos reais no Chromium com Playwright                                                   |

Stack: React + TypeScript + Vite, Tailwind CSS 4 e estilos próprios, Radix Dialog como primitivo acessível equivalente aos diálogos de shadcn/ui, Lucide, React Router, Recharts, Dexie, React Hook Form e Zod. O lockfile fixa as versões efetivamente instaladas. O dashboard carrega sob demanda para separar a biblioteca de gráficos das telas de organização.

As operações de dados passam pela camada de serviços; o React recebe atualizações reativas do Dexie. Relacionamentos são IDs, sem cópias de entidades: `project.areaId`, `task.projectId`, `resource.areaId` e `resource.projectIds`. O modelo de competências permite vínculos com áreas e projetos, mas ainda não possui interface.

## Regras de dados

- Progresso do projeto = tarefas concluídas / tarefas não canceladas. Cinco tarefas com duas concluídas = **40%**. Sem tarefas válidas, aparece **Sem tarefas**, sem percentual inventado.
- Livro com 150 de 500 páginas = **30%**. Cursos seguem o mesmo cálculo por aulas. Não é permitido informar progresso maior que o total. O percentual não altera automaticamente o status do material.
- Datas de prazo são datas civis `AAAA-MM-DD`, interpretadas no fuso local do navegador. **Hoje** inclui pendentes/em andamento com prazo hoje ou vencido. **Próximos 7 dias** inclui hoje e os seis dias seguintes. Tarefas sem prazo ficam na visualização Todas. A semana do dashboard começa na segunda-feira local.
- Ao reabrir uma tarefa, sua data de conclusão é apagada. Canceladas não contam como pendentes nem entram no progresso do projeto.
- Exclusões exigem confirmação. Excluir uma área preserva projetos/recursos sem área. Excluir um projeto preserva tarefas sem projeto e recursos sem aquele vínculo. Competências também são desvinculadas. Desvincular um material ou tarefa preserva o registro independente.
- O histórico registra criação/edição de entidades e conclusão/reabertura de tarefas. Ao excluir uma entidade, seu histórico é removido. Não é um log de auditoria nem registra tempo de estudo.
- Erros de escrita não deixam operações pela metade: registros, relacionamentos e histórico são tratados em transações.

## Backup e armazenamento

Configurações → Exportar backup gera JSON com versão do esquema, data de exportação, áreas, projetos, tarefas, recursos, competências e histórico. Tema e configurações internas do navegador não são exportados.

Para restaurar, selecione um JSON de até 20 MB. O sistema valida versão, campos, datas, IDs únicos, contagens de progresso e integridade dos relacionamentos **antes** de pedir confirmação. A importação substitui o conjunto completo de dados em uma transação, mantendo os IDs. Formato inválido, versão incompatível ou vínculos quebrados são rejeitados sem alterar os dados existentes. Não há mesclagem de backups. Exporte seus dados atuais antes de substituir.

Os dados pertencem ao navegador **e à origem do site** (protocolo, host e porta). Mudar o endereço pode mostrar um banco vazio mesmo no mesmo navegador. Limpar os dados do site, perder o dispositivo ou usar navegação privada pode perder os registros. Não há sincronização ou cópia automática: faça backups regulares. O arquivo JSON contém suas informações pessoais.

## Validação

Os testes automatizados cobrem CRUD, associações, exclusões seguras, criação/conclusão/reabertura, 40% de progresso, 30% de leitura, cursos, filtros de datas, indicadores, reabertura do banco, remoção de exemplos, round-trip de backup e rejeição de backups inválidos sem perda de dados. Os testes de formulário verificam validação e escrita efetiva no IndexedDB usando fake-indexeddb.

Os testes Playwright verificam organização e biblioteca, recarregamento, download/importação do backup, integridade restaurada, indicadores/gráfico, busca, navegação, filtros, Kanban, tema, exclusão segura e layout móvel/teclado. Consulte o resultado do runner ao executá-los; a instalação do pacote Playwright sozinha não valida a interface.

### Resultado executado nesta implementação

| Verificação                          | Resultado                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Instalação reproduzível com `npm ci` | Aprovada                                                                                                                  |
| Vitest + React Testing Library       | **17 testes aprovados**                                                                                                   |
| Playwright / Chromium                | **3 testes de ponta a ponta aprovados**                                                                                   |
| TypeScript, ESLint e Prettier        | Aprovados                                                                                                                 |
| Build Vite de produção               | Aprovado                                                                                                                  |
| Verificação do build no navegador    | Rotas, criação de área, recarga persistente, três setores do gráfico, tema e layout móvel aprovados; sem erros de console |

Os fluxos de aceitação foram executados: projeto com 40%, livro com 30%, persistência após recarga, exportação/importação com relacionamentos preservados, dashboard atualizado, busca e navegação.

## Limites desta versão

Sem backend, autenticação, sincronização, calendário avançado, IA, grafo, upload de PDFs, integrações, cronômetro ou interface de competências. O Kanban muda o status por seletor; não oferece arrastar e soltar. A aplicação precisa ser servida por HTTP(S); abrir `index.html` diretamente não é suportado. Hospedagem estática futura deve redirecionar rotas da SPA para `index.html`. Não há service worker para garantir recarga offline sem servidor.

IndexedDB deve estar disponível e autorizado. A preferência de tema continua válida na sessão se localStorage estiver indisponível. Exportar muitos registros pode exigir mais memória do navegador; o MVP destina-se ao uso pessoal.

## Revisar e integrar

As alterações ficam no checkout e na branch de trabalho do ambiente, sem publicação externa. Para revisar, use `git status`, examine os arquivos novos e `git diff` para arquivos já rastreados, ou a interface de alterações do Codex. Após a revisão, faça commit na branch de trabalho e abra um pull request para `main`. Nenhum push, merge ou deploy é necessário para executar localmente.

Cada tarefa da nuvem já usa um ambiente isolado: utilize o checkout existente, sem criar worktrees para executar o projeto.
