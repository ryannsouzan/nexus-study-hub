# Nexus — Personal Knowledge & Learning Hub

Uma aplicação web em português brasileiro para organizar estudos, projetos, tarefas e referências. A versão 0.2.1 (Fase 2.1) funciona no navegador, com dados persistidos em IndexedDB, sem conta ou API remota.

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
- Biblioteca: Estante responsiva (aproximadamente 4–6 colunas no desktop) e Lista compacta, com preferência persistida no IndexedDB; filtros por tipo/status e busca por título, autor, subtítulo, editora e ISBN. Outros materiais mantêm seus cards e funcionalidades.
- Livros: capa por URL ou upload local, prévia/substituição/remoção, subtítulo, ISBN-10/13, editora, ano, edição e atualização direta da página atual nos detalhes. O ISBN é validado pelo dígito verificador; a grafia original é preservada em `isbn` e a forma sem espaços/hífens em `isbnNormalized`.
- Biblioteca também mantém cursos, artigos, vídeos, apostilas, documentação e outros materiais, incluindo aulas e DOI/revista/ano quando aplicável.
- Busca global por nome/título, descrição, autor e tags, com resultados agrupados que abrem o registro.
- Configurações: tema claro/escuro persistido, exportação e importação JSON e remoção de exemplos.
- Layout responsivo, navegação sem recarregar a página, diálogos com foco e teclado, feedback e estados de carregamento, erro e vazio.

Os exemplos iniciais são explicitamente marcados como **Exemplo**, não registram conclusões ou horas fictícias e podem ser removidos. Alterar um exemplo mantém sua identificação; crie registros próprios se quiser preservá-los ao remover a demonstração. Os exemplos só são instalados na primeira inicialização do banco e não reaparecem depois de removidos.

## Arquitetura

| Local                                                                                      | Responsabilidade                                                                                   |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `src/models/schema.ts`                                                                     | Entidades, tipos e validações Zod, incluindo competências preparadas para uma fase futura          |
| `src/services/db.ts`                                                                       | Dexie, esquema IndexedDB versão 3 e migração automática dos registros da Fase 1, tabelas e índices |
| `src/services/repository.ts`                                                               | CRUD, transações, integridade, histórico, backup e remoção de exemplos                             |
| `src/services/calculations.ts`                                                             | Progresso, indicadores, filtros, busca e datas locais                                              |
| `src/services/covers.ts`                                                                   | Validação, decodificação, otimização proporcional, hash SHA-256 e codificação binária de capas     |
| `src/components/BookCover.tsx`, `BookDetails.tsx`, `CoverFields.tsx`, `LibraryRecords.tsx` | Estante/lista, detalhes editoriais, upload/prévia e fallback de capas                              |
| `src/hooks/useObjectUrl.ts`, `useLibraryView.ts`                                           | Ciclo de vida das URLs temporárias e preferência persistida de visualização                        |
| `src/services/seed.ts`                                                                     | Inicialização idempotente dos dados demonstrativos                                                 |
| `src/hooks/`                                                                               | Consultas reativas, contexto da aplicação e tema                                                   |
| `src/components/`                                                                          | Layout, busca, formulários, cards, diálogos e feedback                                             |
| `src/pages/`                                                                               | Dashboard, coleções, detalhes e configurações                                                      |
| `src/test/`                                                                                | Testes de regras de negócio, banco e formulários                                                   |
| `e2e/`                                                                                     | Fluxos reais no Chromium com Playwright                                                            |

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

Configurações → Exportar backup gera JSON com versão do esquema, data de exportação, áreas, projetos, tarefas, recursos, competências, histórico, capas locais e todas as entidades das trilhas. As imagens são Blobs no IndexedDB e são codificadas em Base64 somente no arquivo JSON. Imagens idênticas são exportadas uma única vez, vinculadas por ID/hash. Tema, preferência Estante/Lista e configurações internas do navegador não são exportados nem substituídos pela importação.

Para restaurar, selecione um JSON de até 100 MB. O sistema valida versão, campos, datas, IDs únicos, contagens de progresso e integridade dos relacionamentos **antes** de pedir confirmação. A importação substitui o conjunto completo de dados em uma transação, mantendo os IDs. Formato inválido, versão incompatível ou vínculos quebrados são rejeitados sem alterar os dados existentes. Backups das versões 1 e 2 continuam aceitos e são normalizados para o esquema atual. Backups de versões futuras não são aceitos. Não há mesclagem de backups. Exporte seus dados atuais antes de substituir.

Os dados pertencem ao navegador **e à origem do site** (protocolo, host e porta). Mudar o endereço pode mostrar um banco vazio mesmo no mesmo navegador. Limpar os dados do site, perder o dispositivo ou usar navegação privada pode perder os registros. Não há sincronização ou cópia automática: faça backups regulares. O arquivo JSON contém suas informações pessoais.

## Capas de livros e migração 1 → 2

O upload aceita **PNG, JPEG e WebP com até 5 MB**. O conteúdo é verificado pelo formato binário e pelo decodificador real do navegador. Imagens corrompidas são rejeitadas; o arquivo anterior permanece intacto. O limite de resolução de entrada é 40 megapixels.

A imagem é redimensionada proporcionalmente, sem ampliar, para até **800 × 1200 pixels**. O canvas prefere WebP com qualidade 0,82 e aceita PNG como fallback do navegador. A imagem otimizada deve ter até 2 MB; a original em alta resolução não é retida. A exibição usa proporção 2:3 com `object-fit: contain`, sem recortar ou distorcer a imagem. Capas ausentes ou indisponíveis mostram um placeholder. Há alt text, carregamento preguiçoso, estados de carregamento/erro e controles por teclado.

A tabela `covers` armazena `{ id, blob, mime, width, height }`, com SHA-256 do conteúdo como ID, e o recurso armazena `coverId`. Não há imagens em localStorage. Livros que usam o mesmo binário compartilham um Blob. Substituir/remover uma capa, excluir um livro, convertê-lo em outro tipo ou remover exemplos libera o Blob somente quando nenhum outro livro o referencia. Alterações e limpeza são transacionais. As URLs de objeto são temporárias, recriadas ao carregar e revogadas ao trocar a imagem ou desmontar o componente.

URLs externas são opcionais e devem usar HTTP(S); a aplicação preserva apenas a URL, sem baixar ou incluir a imagem no backup. Elas dependem de internet, disponibilidade e regras do servidor de origem. Uma falha de carregamento não impede consultar ou editar o livro. Local e URL são fontes alternativas: selecionar uma substitui a outra.

A migração Dexie da versão 1 para 2 mantém IDs, estados, progresso e relacionamentos, adiciona campos opcionais aos registros existentes e cria a tabela de capas. Faça um backup antes de atualizar e evite voltar para uma versão antiga da aplicação depois da migração (ela não conhece o esquema 2).

A restauração valida estrutura, Base64, tipo e tamanho binário, referências, dimensões, decodificação e hash SHA-256 das imagens **antes de iniciar a substituição**. Uma falha de integridade ou armazenamento mantém o conjunto anterior graças à transação. JSONs grandes usam memória temporária; o limite de importação na interface é 100 MB. A origem deve ser segura (HTTPS ou localhost) para as APIs de armazenamento/criptografia do navegador.

## Validação

Os testes automatizados cobrem CRUD, associações, exclusões seguras, criação/conclusão/reabertura, 40% de progresso, 30% de leitura, cursos, filtros de datas, indicadores, reabertura do banco, remoção de exemplos, round-trip de backup e rejeição de backups inválidos sem perda de dados. Os testes de formulário verificam validação e escrita efetiva no IndexedDB usando fake-indexeddb.

Os testes de capas verificam criação sem capa e por URL, deduplicação, troca/remoção/limpeza, backup binário, rejeição de imagens adulteradas, migração v1 e revogação de URLs temporárias. O jsdom usa um decodificador simulado; os testes Chromium executam a decodificação e a otimização reais.

Os testes Playwright verificam upload PNG válido, formato/tamanho inválidos, imagem corrompida, WebP proporcional, substituição e remoção, recarga com capa persistente, exportação/importação das imagens, Estante/Lista persistentes, filtros, fallback de URL e responsividade, além de organização e biblioteca, recarregamento, download/importação do backup, integridade restaurada, indicadores/gráfico, busca, navegação, filtros, Kanban, tema, exclusão segura e layout móvel/teclado. Consulte o resultado do runner ao executá-los; a instalação do pacote Playwright sozinha não valida a interface.

### Resultado executado na Fase 1 (antes da Melhoria 1.1)

| Verificação                          | Resultado                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Instalação reproduzível com `npm ci` | Aprovada                                                                                                                  |
| Vitest + React Testing Library       | **17 testes aprovados**                                                                                                   |
| Playwright / Chromium                | **3 testes de ponta a ponta aprovados**                                                                                   |
| TypeScript, ESLint e Prettier        | Aprovados                                                                                                                 |
| Build Vite de produção               | Aprovado                                                                                                                  |
| Verificação do build no navegador    | Rotas, criação de área, recarga persistente, três setores do gráfico, tema e layout móvel aprovados; sem erros de console |

Os fluxos de aceitação foram executados: projeto com 40%, livro com 30%, persistência após recarga, exportação/importação com relacionamentos preservados, dashboard atualizado, busca e navegação.

### Resultado executado na Melhoria 1.1

- **27 testes** Vitest/Testing Library aprovados.
- **5 cenários** Playwright/Chromium aprovados: upload/otimização/troca/remoção/restauração; Estante/Lista, filtros e responsividade; e os três cenários de regressão da Fase 1.
- TypeScript, ESLint, Prettier e build de produção aprovados.
- Capturas dos dois modos, detalhes, tema escuro e mobile geradas com dados de exemplo e capas ilustrativas de teste.

## Limites desta versão

Sem backend, autenticação, sincronização, calendário avançado, IA, grafo global de conhecimento, upload de PDFs, integrações externas, cronômetro ou interface de competências. O Kanban muda o status por seletor; não oferece arrastar e soltar. A aplicação precisa ser servida por HTTP(S); abrir `index.html` diretamente não é suportado. Hospedagem estática futura deve redirecionar rotas da SPA para `index.html`. Não há service worker para garantir recarga offline sem servidor.

IndexedDB deve estar disponível e autorizado. A preferência de tema continua válida na sessão se localStorage estiver indisponível. Exportar muitos registros pode exigir mais memória do navegador; o MVP destina-se ao uso pessoal.

## Revisar e integrar

As alterações ficam no checkout e na branch de trabalho do ambiente, sem publicação externa. Para revisar, use `git status`, examine os arquivos novos e `git diff` para arquivos já rastreados, ou a interface de alterações do Codex. Após a revisão, faça commit na branch de trabalho e abra um pull request para `main`. Nenhum push, merge ou deploy é necessário para executar localmente.

Cada tarefa da nuvem já usa um ambiente isolado: utilize o checkout existente, sem criar worktrees para executar o projeto.

## Revisar a Melhoria 1.1

A branch `feat/library-book-covers` parte da `main` após a integração da Fase 1 pelo PR #1. Compare a branch com `main` para revisar somente a melhoria. Não é necessário fazer merge ou publicar a aplicação para testar a branch com `npm ci` e `npm run dev`.

## Fase 2.1 — Trilhas de aprendizagem

Acesse **Desenvolvimento → Trilhas de aprendizagem**. Crie uma trilha, associe uma área/projeto e organize etapas, objetivos, tópicos e pré-requisitos. Lista estruturada, Roadmap e Por progresso compartilham os mesmos dados; a preferência de visualização persiste no navegador. O Roadmap usa React Flow, layout automático, zoom, arraste do fundo, centralização e seleção por teclado. Os vínculos são editados no painel da etapa.

A visão geral oferece busca, filtros por área/status, ordenação por prioridade/atualização/prazo, edição, arquivamento e exclusão. Áreas e projetos exibem trilhas relacionadas; o dashboard mostra trilhas ativas e próximos passos. Os exemplos de DoE, Python e espectrometria de massas são carregados somente por solicitação, marcados como exemplos e sem conclusões fictícias.

### Conclusão e progresso

- Dependências formam um DAG dentro de cada trilha: autorreferência, duplicação, ciclos e vínculos entre trilhas são rejeitados. Uma etapa só pode ser concluída após todos os pré-requisitos e critérios obrigatórios. Não há conclusão forçada.
- Critérios podem exigir tarefa concluída, tópico dominado por autoavaliação, evidência textual ou avaliação manual. Tarefas concluídas não significam domínio automático. Critérios opcionais não bloqueiam nem entram no percentual.
- Progresso da etapa é a fração de critérios obrigatórios atendidos. Sem critérios obrigatórios aparece **Sem progresso mensurável**. Concluir a etapa exige ação explícita, mesmo com 100% dos critérios.
- O progresso da trilha é a média ponderada das etapas mensuráveis: peso configurado, senão horas estimadas, senão 1. A interface informa quantas etapas entram no cálculo; etapas sem critérios ficam fora da média. A trilha só pode ser concluída explicitamente quando todas as etapas estiverem concluídas.
- Reabrir uma tarefa, remover evidência ou alterar domínio pode invalidar etapas concluídas e seus descendentes; suas datas de conclusão são apagadas e uma trilha concluída volta a ativa. Nunca há conclusão automática.
- Tarefas e materiais são associados por ID, sem cópias. Excluir trilhas/etapas remove os registros próprios e associações, preservando tarefas, materiais e capas. Excluir uma área/projeto desvincula a trilha; excluir tarefas/materiais remove seus vínculos. Reordenar etapas não modifica dependências.

### Persistência e migração

O esquema Dexie 3 adiciona sete tabelas normalizadas: `learningPaths`, `learningStages`, `learningTopics`, `learningDependencies`, `learningStageResources`, `learningStageTasks` e `learningCriteria`. A migração é aditiva e mantém registros, IDs e Blobs de capas existentes. O JSON de backup é versão 3; versões 1 e 2 são normalizadas com coleções de trilhas vazias. A importação valida também referências, posições, ciclos e coerência das conclusões antes de substituir tudo em uma transação. Preferências locais não são substituídas.

`src/models/learning.ts` define os contratos Zod; `src/domain/learning.ts` concentra DAG, critérios, progresso e validação de backup; `src/services/learning.ts` implementa operações transacionais; `learningState.ts` reconcilia conclusões; `learningExamples.ts` instala demonstrações opcionais. As páginas estão em `src/pages/learning` e os editores/painéis em `src/components/learning`. As rotas de trilhas e a biblioteca React Flow carregam sob demanda.

### Validação da Fase 2.1

Resultado executado: **38 testes unitários/de integração** e **7 cenários Chromium** aprovados (regressão das fases anteriores e dois cenários de trilhas). TypeScript, ESLint, Prettier e build de produção aprovados.

Os testes incluem CRUD, ordenação, múltiplos pré-requisitos, ciclos longos, bloqueio/desbloqueio, ponderação, autoavaliação, reutilização de tarefas, cascatas seguras, persistência, migração v2 e backup inválido. O cenário Chromium de DoE cria quatro etapas, tarefa, tópico, evidência e avaliação manual, associa um livro, usa o Roadmap por teclado, conclui a trilha, reabre uma tarefa e restaura o backup. Outro cenário verifica exemplos opcionais, filtros, ordenação, exclusão e mobile. Capturas geradas usam dados de teste.

Para revisar esta entrega, compare `feat/learning-paths` com `main`. Não há merge automático nem deploy.
