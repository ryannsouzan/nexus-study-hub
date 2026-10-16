import { z } from 'zod';
export const pathStatuses = {
  planned: 'Planejada',
  active: 'Ativa',
  paused: 'Pausada',
  completed: 'Concluída',
  archived: 'Arquivada',
} as const;
export const learningPriorities = { high: 'Alta', medium: 'Média', low: 'Baixa' } as const;
export const stageStatuses = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
} as const;
export const topicStatuses = {
  not_started: 'Não iniciado',
  studying: 'Estudando',
  practicing: 'Praticando',
  mastered: 'Dominado',
} as const;
const name = z.string().trim().min(1, 'Informe um título.').max(200, 'Use até 200 caracteres.');
const text = z.string().max(10000, 'Use até 10.000 caracteres.');
const effort = z
  .number()
  .finite()
  .positive('Informe um valor maior que zero.')
  .max(100000)
  .optional();
const base = { id: z.uuid(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() };
export const pathInputSchema = z.object({
  title: name,
  description: text,
  objective: text,
  areaId: z.string(),
  projectId: z.string(),
  status: z.enum(['planned', 'active', 'paused', 'completed', 'archived']),
  priority: z.enum(['low', 'medium', 'high']),
  estimatedHours: effort,
  targetDate: z
    .string()
    .refine(
      (v) =>
        !v ||
        (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
          !Number.isNaN(Date.parse(v)) &&
          new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v),
      'Prazo inválido.',
    ),
});
export const learningPathSchema = pathInputSchema
  .extend({ ...base, completedAt: z.iso.datetime().nullable(), example: z.boolean() })
  .refine(
    (p) => (p.status === 'completed') === (p.completedAt !== null),
    'Data de conclusão da trilha inconsistente.',
  );
export const stageInputSchema = z.object({
  learningPathId: z.uuid(),
  title: name,
  description: text,
  learningObjectives: z.array(name),
  estimatedHours: effort,
  weight: effort,
});
export const learningStageSchema = stageInputSchema
  .extend({
    ...base,
    position: z.number().int().min(0),
    status: z.enum(['not_started', 'in_progress', 'completed']),
    completedAt: z.iso.datetime().nullable(),
  })
  .refine(
    (s) => (s.status === 'completed') === (s.completedAt !== null),
    'Data de conclusão da etapa inconsistente.',
  );
export const topicInputSchema = z.object({
  stageId: z.uuid(),
  title: name,
  description: text,
  status: z.enum(['not_started', 'studying', 'practicing', 'mastered']),
  estimatedHours: effort,
});
export const learningTopicSchema = topicInputSchema.extend(base);
export const learningDependencySchema = z.object({
  id: z.uuid(),
  learningPathId: z.uuid(),
  prerequisiteStageId: z.uuid(),
  dependentStageId: z.uuid(),
  createdAt: z.iso.datetime(),
});
export const stageResourceSchema = z.object({
  id: z.uuid(),
  stageId: z.uuid(),
  resourceId: z.string().min(1),
});
export const stageTaskSchema = z.object({
  id: z.uuid(),
  stageId: z.uuid(),
  taskId: z.string().min(1),
});
export const criterionInputSchema = z
  .object({
    stageId: z.uuid(),
    title: name,
    type: z.enum(['task', 'topic', 'evidence', 'manual']),
    targetId: z.string(),
    required: z.boolean(),
    checked: z.boolean(),
    evidence: text,
  })
  .refine((c) => !['task', 'topic'].includes(c.type) || !!c.targetId, {
    message: 'Selecione um registro para este critério.',
    path: ['targetId'],
  });
export const learningCriterionSchema = criterionInputSchema.safeExtend(base);
export const learningBackupFields = {
  learningPaths: z.array(learningPathSchema),
  learningStages: z.array(learningStageSchema),
  learningTopics: z.array(learningTopicSchema),
  learningDependencies: z.array(learningDependencySchema),
  learningStageResources: z.array(stageResourceSchema),
  learningStageTasks: z.array(stageTaskSchema),
  learningCriteria: z.array(learningCriterionSchema),
};
export const emptyLearning = {
  learningPaths: [],
  learningStages: [],
  learningTopics: [],
  learningDependencies: [],
  learningStageResources: [],
  learningStageTasks: [],
  learningCriteria: [],
};
export type LearningPath = z.infer<typeof learningPathSchema>;
export type LearningStage = z.infer<typeof learningStageSchema>;
export type LearningTopic = z.infer<typeof learningTopicSchema>;
export type LearningDependency = z.infer<typeof learningDependencySchema>;
export type StageResource = z.infer<typeof stageResourceSchema>;
export type StageTask = z.infer<typeof stageTaskSchema>;
export type LearningCriterion = z.infer<typeof learningCriterionSchema>;
export type PathInput = z.infer<typeof pathInputSchema>;
export type StageInput = z.infer<typeof stageInputSchema>;
export type TopicInput = z.infer<typeof topicInputSchema>;
export type CriterionInput = z.infer<typeof criterionInputSchema>;
export type LearningData = {
  learningPaths: LearningPath[];
  learningStages: LearningStage[];
  learningTopics: LearningTopic[];
  learningDependencies: LearningDependency[];
  learningStageResources: StageResource[];
  learningStageTasks: StageTask[];
  learningCriteria: LearningCriterion[];
};
