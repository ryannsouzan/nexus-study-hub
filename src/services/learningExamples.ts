import { db } from './db';
import { savePath, saveStage, saveCriterion, addDependency } from './learning';
export async function loadLearningExamples() {
  return db.transaction('rw', db.tables, async () => {
    if ((await db.learningPaths.toArray()).some((p) => p.example))
      throw new Error('As trilhas de exemplo já estão carregadas.');
    const areas = await db.areas.toArray();
    const specifications = [
      {
        title: 'Design of Experiments',
        area: 'Desenvolvimento Analítico',
        steps: [
          'Fundamentos de estatística',
          'Planejamento fatorial completo',
          'Planejamento fatorial fracionado',
          'ANOVA e análise de efeitos',
          'Metodologia de superfície de resposta',
          'Otimização de métodos cromatográficos',
          'Projeto prático de desenvolvimento analítico',
        ],
        edges: [
          [0, 1],
          [1, 2],
          [1, 3],
          [2, 4],
          [3, 4],
          [4, 5],
          [5, 6],
        ],
      },
      {
        title: 'Python para dados científicos',
        area: 'Programação',
        steps: [
          'Fundamentos de Python',
          'NumPy',
          'Pandas',
          'Matplotlib',
          'Estatística aplicada',
          'Processamento de dados laboratoriais',
          'Projeto prático de automação de relatórios',
        ],
        edges: [
          [0, 1],
          [1, 2],
          [1, 3],
          [2, 4],
          [2, 5],
          [3, 5],
          [4, 5],
          [5, 6],
        ],
      },
      {
        title: 'Espectrometria de massas aplicada',
        area: 'Desenvolvimento Analítico',
        steps: [
          'Fundamentos de espectrometria de massas',
          'Processos de ionização',
          'Analisadores de massas',
          'Interpretação de espectros',
          'LC-MS',
          'Análise de oligonucleotídeos',
          'Desenvolvimento de métodos por LC-MS',
        ],
        edges: [
          [0, 1],
          [0, 2],
          [1, 3],
          [2, 3],
          [3, 4],
          [4, 5],
          [5, 6],
        ],
      },
    ];
    for (const spec of specifications) {
      const pathId = await savePath({
        title: spec.title,
        description: 'Trilha demonstrativa, editável e removível. Não representa progresso real.',
        objective: `Construir uma base e aplicar ${spec.title.toLocaleLowerCase('pt-BR')} em um projeto prático.`,
        areaId: areas.find((a) => a.name === spec.area)?.id ?? '',
        projectId: '',
        status: 'planned',
        priority: 'medium',
        targetDate: '',
      });
      await db.learningPaths.update(pathId, { example: true });
      const ids = [];
      for (const title of spec.steps) {
        const id = await saveStage({
          learningPathId: pathId,
          title,
          description: 'Adapte esta etapa à sua necessidade.',
          learningObjectives: [`Explicar e aplicar: ${title}`],
        });
        ids.push(id);
        await saveCriterion({
          stageId: id,
          title: 'Registrar uma aplicação prática',
          type: 'evidence',
          targetId: '',
          required: true,
          checked: false,
          evidence: '',
        });
      }
      for (const [from, to] of spec.edges) await addDependency(ids[from], ids[to]);
    }
  });
}
