import { z } from 'zod';
export const priorities = { alta: 'Alta', media: 'Média', baixa: 'Baixa' } as const;
export const projectStatuses = {
  planejado: 'Planejado',
  andamento: 'Em andamento',
  pausado: 'Pausado',
  concluido: 'Concluído',
} as const;
export const taskStatuses = {
  pendente: 'Pendente',
  andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
} as const;
export const resourceStatuses = {
  desejo: 'Quero estudar',
  andamento: 'Em andamento',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
} as const;
export const resourceTypes = {
  livro: 'Livro',
  artigo: 'Artigo científico',
  curso: 'Curso',
  video: 'Vídeo',
  apostila: 'Apostila',
  documentacao: 'Documentação',
  outro: 'Outro',
} as const;
const title = z
  .string()
  .trim()
  .min(1, 'Informe um nome ou título.')
  .max(200, 'Use até 200 caracteres.');
const description = z.string().max(10000, 'Use até 10.000 caracteres.');
const date = z
  .string()
  .refine(
    (value) =>
      value === '' ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(value)) &&
        new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value),
    'Data inválida.',
  );
const metadata = {
  id: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  example: z.boolean(),
};
export const areaInputSchema = z.object({
  name: title,
  description,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida.'),
  icon: z.enum(['flask', 'code', 'book', 'brain', 'globe', 'leaf']),
});
export const projectInputSchema = z
  .object({
    name: title,
    description,
    objective: description,
    areaId: z.string(),
    status: z.enum(['planejado', 'andamento', 'pausado', 'concluido']),
    priority: z.enum(['alta', 'media', 'baixa']),
    startDate: date,
    deadline: date,
  })
  .refine((p) => !p.startDate || !p.deadline || p.deadline >= p.startDate, {
    message: 'O prazo deve ser igual ou posterior ao início.',
    path: ['deadline'],
  });
export const taskInputSchema = z.object({
  title,
  description,
  projectId: z.string(),
  status: z.enum(['pendente', 'andamento', 'concluida', 'cancelada']),
  priority: z.enum(['alta', 'media', 'baixa']),
  deadline: date,
});
export const resourceInputSchema = z
  .object({
    title,
    author: z.string().max(200),
    type: z.enum(['livro', 'artigo', 'curso', 'video', 'apostila', 'documentacao', 'outro']),
    description,
    url: z.string().refine((v) => {
      if (!v) return true;
      try {
        return ['http:', 'https:'].includes(new URL(v).protocol);
      } catch {
        return false;
      }
    }, 'Use um link http ou https válido.'),
    areaId: z.string(),
    projectIds: z.array(z.string().min(1)),
    tags: z.array(z.string().trim().min(1).max(80)),
    status: z.enum(['desejo', 'andamento', 'concluido', 'arquivado']),
    totalPages: z.number().int().min(0),
    currentPage: z.number().int().min(0),
    doi: z.string().max(200),
    journal: z.string().max(300),
    year: z.number().int().min(0).max(9999),
    platform: z.string().max(200),
    totalLessons: z.number().int().min(0),
    completedLessons: z.number().int().min(0),
  })
  .refine((r) => r.currentPage <= r.totalPages, {
    message: 'A página atual não pode superar o total.',
    path: ['currentPage'],
  })
  .refine((r) => r.completedLessons <= r.totalLessons, {
    message: 'As aulas concluídas não podem superar o total.',
    path: ['completedLessons'],
  });
export const areaSchema = areaInputSchema.extend(metadata);
export const projectSchema = projectInputSchema.safeExtend(metadata);
export const taskSchema = taskInputSchema
  .extend({ ...metadata, completedAt: z.iso.datetime().nullable() })
  .refine((t) => (t.status === 'concluida') === (t.completedAt !== null), {
    message: 'Data de conclusão inconsistente.',
    path: ['completedAt'],
  });
export const resourceSchema = resourceInputSchema.safeExtend(metadata);
export const competencySchema = z.object({
  ...metadata,
  name: title,
  description,
  areaIds: z.array(z.string()),
  projectIds: z.array(z.string()),
});
export const activitySchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  entity: z.enum(['area', 'project', 'task', 'resource']),
  label: title,
  action: z.enum(['created', 'updated', 'completed', 'reopened', 'deleted']),
  at: z.iso.datetime(),
  example: z.boolean(),
});
export const backupSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  areas: z.array(areaSchema),
  projects: z.array(projectSchema),
  tasks: z.array(taskSchema),
  resources: z.array(resourceSchema),
  competencies: z.array(competencySchema),
  activities: z.array(activitySchema),
});
export type Area = z.infer<typeof areaSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type Competency = z.infer<typeof competencySchema>;
export type Activity = z.infer<typeof activitySchema>;
export type Backup = z.infer<typeof backupSchema>;
export type AreaInput = z.infer<typeof areaInputSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type ResourceInput = z.infer<typeof resourceInputSchema>;
export type EntityKind = 'area' | 'project' | 'task' | 'resource';
