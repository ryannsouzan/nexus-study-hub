import { db } from './db';
import { localDate } from './calculations';
export async function initializeDatabase() {
  await db.transaction(
    'rw',
    [db.areas, db.projects, db.tasks, db.resources, db.settings],
    async () => {
      if (await db.settings.get('initialized')) return;
      if (
        (await db.areas.count()) ||
        (await db.projects.count()) ||
        (await db.tasks.count()) ||
        (await db.resources.count())
      ) {
        await db.settings.put({ key: 'initialized', value: 'true' });
        return;
      }
      const now = new Date().toISOString();
      const metadata = { createdAt: now, updatedAt: now, example: true };
      await db.areas.bulkAdd([
        {
          id: 'demo-analitico',
          name: 'Desenvolvimento Analítico',
          description: 'Métodos, cromatografia e planejamento experimental.',
          color: '#628d74',
          icon: 'flask',
          ...metadata,
        },
        {
          id: 'demo-programacao',
          name: 'Programação',
          description: 'Python, ciência de dados e automações úteis.',
          color: '#758eab',
          icon: 'code',
          ...metadata,
        },
        {
          id: 'demo-farmacia',
          name: 'Farmácia',
          description: 'Fundamentos e estudos da graduação.',
          color: '#a98d65',
          icon: 'book',
          ...metadata,
        },
        {
          id: 'demo-pesquisa',
          name: 'Pesquisa Científica',
          description: 'Leitura crítica e prática científica.',
          color: '#9a82a8',
          icon: 'brain',
          ...metadata,
        },
      ]);
      await db.projects.bulkAdd([
        {
          id: 'demo-doe',
          name: 'Estudar Design of Experiments',
          areaId: 'demo-analitico',
          description: 'Construir uma base em planejamento de experimentos.',
          objective: 'Planejar e interpretar um experimento fatorial.',
          status: 'andamento',
          priority: 'alta',
          startDate: '',
          deadline: '',
          ...metadata,
        },
        {
          id: 'demo-lcms',
          name: 'Desenvolvimento de método LC-MS para poly(A)',
          areaId: 'demo-analitico',
          description: 'Organizar fundamentos e referências para análise de oligonucleotídeos.',
          objective: 'Definir um plano de desenvolvimento analítico.',
          status: 'planejado',
          priority: 'alta',
          startDate: '',
          deadline: '',
          ...metadata,
        },
        {
          id: 'demo-pandas',
          name: 'Aprender Pandas',
          areaId: 'demo-programacao',
          description: 'Explorar, transformar e analisar dados com Python.',
          objective: 'Analisar um conjunto de dados laboratoriais.',
          status: 'andamento',
          priority: 'media',
          startDate: '',
          deadline: '',
          ...metadata,
        },
        {
          id: 'demo-relatorios',
          name: 'Automatizar relatórios laboratoriais',
          areaId: 'demo-programacao',
          description: 'Reduzir o trabalho repetitivo na preparação de relatórios.',
          objective: 'Criar um fluxo reprodutível de relatórios.',
          status: 'planejado',
          priority: 'baixa',
          startDate: '',
          deadline: '',
          ...metadata,
        },
        {
          id: 'demo-quimica',
          name: 'Revisar Química Analítica',
          areaId: 'demo-farmacia',
          description: 'Revisar conceitos, cálculos e exercícios fundamentais.',
          objective: 'Consolidar os fundamentos de química analítica.',
          status: 'andamento',
          priority: 'media',
          startDate: '',
          deadline: '',
          ...metadata,
        },
        {
          id: 'demo-graduacao',
          name: 'Organizar estudos da graduação',
          areaId: 'demo-farmacia',
          description: 'Estruturar disciplinas e próximos passos.',
          objective: 'Ter um plano de estudos sustentável.',
          status: 'planejado',
          priority: 'baixa',
          startDate: '',
          deadline: '',
          ...metadata,
        },
      ]);
      await db.tasks.bulkAdd([
        {
          id: 'demo-t1',
          title: 'Revisar conceitos de experimentos fatoriais',
          projectId: 'demo-doe',
          deadline: localDate(),
          priority: 'alta',
          status: 'pendente',
          description: 'Tarefa de exemplo. Adapte ao seu plano de estudos.',
          completedAt: null,
          ...metadata,
        },
        {
          id: 'demo-t2',
          title: 'Explorar seleção e filtros de DataFrames',
          projectId: 'demo-pandas',
          deadline: localDate(),
          priority: 'media',
          status: 'pendente',
          description: 'Tarefa de exemplo para praticar Pandas.',
          completedAt: null,
          ...metadata,
        },
        {
          id: 'demo-t3',
          title: 'Selecionar referências de LC-MS',
          projectId: 'demo-lcms',
          deadline: '',
          priority: 'alta',
          status: 'pendente',
          description: 'Reunir materiais para o projeto.',
          completedAt: null,
          ...metadata,
        },
        {
          id: 'demo-t4',
          title: 'Resolver exercícios de equilíbrio químico',
          projectId: 'demo-quimica',
          deadline: '',
          priority: 'media',
          status: 'pendente',
          description: 'Escolher uma lista de exercícios.',
          completedAt: null,
          ...metadata,
        },
      ]);
      const base = {
        author: '',
        description:
          'Material demonstrativo para organizar sua biblioteca. Substitua pela referência que você utiliza.',
        url: '',
        projectIds: [],
        tags: ['exemplo'],
        status: 'desejo' as const,
        totalPages: 0,
        currentPage: 0,
        doi: '',
        journal: '',
        year: 0,
        platform: '',
        totalLessons: 0,
        completedLessons: 0,
        ...metadata,
      };
      await db.resources.bulkAdd([
        {
          ...base,
          id: 'demo-r1',
          title: 'Fundamentos de cromatografia líquida',
          type: 'livro',
          areaId: 'demo-analitico',
          projectIds: ['demo-lcms'],
        },
        {
          ...base,
          id: 'demo-r2',
          title: 'Introdução à espectrometria de massas',
          type: 'documentacao',
          areaId: 'demo-analitico',
          projectIds: ['demo-lcms'],
        },
        {
          ...base,
          id: 'demo-r3',
          title: 'Planejamento experimental e estatística',
          type: 'livro',
          areaId: 'demo-analitico',
          projectIds: ['demo-doe'],
        },
        {
          ...base,
          id: 'demo-r4',
          title: 'Python for Data Analysis',
          author: 'Wes McKinney',
          type: 'livro',
          areaId: 'demo-programacao',
          projectIds: ['demo-pandas'],
          url: 'https://wesmckinney.com/book/',
        },
        {
          ...base,
          id: 'demo-r5',
          title: 'Guia de leitura crítica de artigos',
          type: 'apostila',
          areaId: 'demo-pesquisa',
        },
      ]);
      await db.settings.put({ key: 'initialized', value: 'true' });
    },
  );
}
