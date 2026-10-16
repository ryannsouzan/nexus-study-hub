import type {
  LearningPath,
  LearningStage,
  LearningTopic,
  LearningDependency,
  StageResource,
  StageTask,
  LearningCriterion,
} from '../models/learning';
import { bookDefaults } from '../models/books';
import type { CoverAsset } from './covers';
import Dexie, { type EntityTable } from 'dexie';
import type { Area, Project, Task, Resource, Competency, Activity } from '../models/schema';
export class NexusDatabase extends Dexie {
  areas!: EntityTable<Area, 'id'>;
  projects!: EntityTable<Project, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  resources!: EntityTable<Resource, 'id'>;
  competencies!: EntityTable<Competency, 'id'>;
  activities!: EntityTable<Activity, 'id'>;
  covers!: EntityTable<CoverAsset, 'id'>;
  learningPaths!: EntityTable<LearningPath, 'id'>;
  learningStages!: EntityTable<LearningStage, 'id'>;
  learningTopics!: EntityTable<LearningTopic, 'id'>;
  learningDependencies!: EntityTable<LearningDependency, 'id'>;
  learningStageResources!: EntityTable<StageResource, 'id'>;
  learningStageTasks!: EntityTable<StageTask, 'id'>;
  learningCriteria!: EntityTable<LearningCriterion, 'id'>;
  settings!: EntityTable<{ key: string; value: string }, 'key'>;
  constructor(name = 'nexus-study-hub') {
    super(name);
    this.version(1).stores({
      areas: 'id, name',
      projects: 'id, areaId, status, updatedAt',
      tasks: 'id, projectId, status, deadline, completedAt',
      resources: 'id, areaId, type, status, *projectIds, *tags',
      competencies: 'id, *areaIds, *projectIds',
      activities: 'id, at, entityId',
      settings: 'key',
    });
    this.version(2)
      .stores({ resources: 'id, areaId, type, status, *projectIds, *tags, coverId', covers: 'id' })
      .upgrade(async (transaction) => {
        await transaction
          .table('resources')
          .toCollection()
          .modify((resource) => {
            for (const [key, value] of Object.entries(bookDefaults))
              if (resource[key] === undefined) resource[key] = value;
          });
      });
    this.version(3).stores({
      learningPaths: 'id, areaId, projectId, status, updatedAt',
      learningStages: 'id, learningPathId, [learningPathId+position]',
      learningTopics: 'id, stageId',
      learningDependencies:
        'id, learningPathId, prerequisiteStageId, dependentStageId, &[prerequisiteStageId+dependentStageId]',
      learningStageResources: 'id, stageId, resourceId, &[stageId+resourceId]',
      learningStageTasks: 'id, stageId, taskId, &[stageId+taskId]',
      learningCriteria: 'id, stageId, [type+targetId]',
    });
  }
}
export const db = new NexusDatabase();
