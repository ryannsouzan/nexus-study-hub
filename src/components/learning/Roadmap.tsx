import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Panel,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { Plus, Minus, Maximize2, LockKeyhole, CheckCircle2 } from 'lucide-react';
import type { LearningSnapshot } from '../../domain/learning';
import { orderedStages, stageProgress, unmetPrerequisites } from '../../domain/learning';
import { stageStatuses } from '../../models/learning';
import '@xyflow/react/dist/style.css';
type RoadNode = Node<
  { title: string; status: string; blocked: boolean; progress: number | null; onOpen: () => void },
  'stage'
>;
function StageNode({ data, selected }: NodeProps<RoadNode>) {
  return (
    <div className={`roadmap-node ${data.blocked ? 'blocked' : ''} ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <button
        className="roadmap-stage-button"
        aria-label={`Abrir etapa ${data.title}`}
        onClick={data.onOpen}
      >
        <div className="roadmap-status">
          {data.blocked ? (
            <LockKeyhole size={15} />
          ) : data.status === 'Concluída' ? (
            <CheckCircle2 size={15} />
          ) : (
            <span className="roadmap-dot" />
          )}
          <span>{data.blocked ? 'Bloqueada' : data.status}</span>
        </div>
        <strong>{data.title}</strong>
        <small>
          {data.progress === null ? 'Sem progresso mensurável' : `${data.progress}% dos critérios`}
        </small>
      </button>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { stage: StageNode };
function ZoomControls() {
  const flow = useReactFlow();
  return (
    <Panel position="bottom-left" className="roadmap-controls">
      <button aria-label="Ampliar roadmap" onClick={() => flow.zoomIn()}>
        <Plus size={17} />
      </button>
      <button aria-label="Reduzir roadmap" onClick={() => flow.zoomOut()}>
        <Minus size={17} />
      </button>
      <button aria-label="Centralizar roadmap" onClick={() => flow.fitView({ padding: 0.2 })}>
        <Maximize2 size={17} />
      </button>
    </Panel>
  );
}
export function Roadmap({
  pathId,
  data,
  selected,
  onSelect,
}: {
  pathId: string;
  data: LearningSnapshot;
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const stages = orderedStages(pathId, data);
  const deps = data.learningDependencies.filter((d) => d.learningPathId === pathId);
  const levels = new Map<string, number>();
  const pending = [...stages];
  while (pending.length) {
    const ready = pending.findIndex((s) =>
      deps
        .filter((d) => d.dependentStageId === s.id)
        .every((d) => levels.has(d.prerequisiteStageId)),
    );
    if (ready < 0) break;
    const [s] = pending.splice(ready, 1);
    levels.set(
      s.id,
      Math.max(
        0,
        ...deps
          .filter((d) => d.dependentStageId === s.id)
          .map((d) => levels.get(d.prerequisiteStageId)! + 1),
      ),
    );
  }
  const rows = new Map<number, number>();
  const nodes: RoadNode[] = stages.map((s) => {
    const level = levels.get(s.id) ?? 0;
    const row = rows.get(level) ?? 0;
    rows.set(level, row + 1);
    return {
      id: s.id,
      type: 'stage',
      position: { x: level * 290, y: row * 165 },
      selected: selected === s.id,
      ariaLabel: `Etapa ${s.title}. ${unmetPrerequisites(s.id, data).length ? 'Bloqueada' : stageStatuses[s.status]}`,
      data: {
        onOpen: () => onSelect(s.id),
        title: s.title,
        status: stageStatuses[s.status],
        blocked: !!unmetPrerequisites(s.id, data).length,
        progress: stageProgress(s.id, data),
      },
    };
  });
  const edges = deps.map((d) => ({
    id: d.id,
    source: d.prerequisiteStageId,
    target: d.dependentStageId,
    markerEnd: { type: MarkerType.ArrowClosed },
    ariaLabel: `Pré-requisito de ${stages.find((s) => s.id === d.dependentStageId)?.title}`,
    style: { stroke: 'var(--accent)', strokeWidth: 1.5 },
  }));
  return (
    <section className="roadmap-shell" aria-label="Roadmap de aprendizagem">
      <p className="calculation-note">
        Arraste o fundo para explorar. Use +/− para zoom e clique numa etapa para abrir os detalhes.
        As setas indicam pré-requisitos.
      </p>
      <div className="roadmap-canvas">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.15}
            maxZoom={1.8}
            nodesDraggable={false}
            nodesConnectable={false}
            onNodeClick={(_, node) => onSelect(node.id)}
            onNodeDoubleClick={(_, node) => onSelect(node.id)}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--border)" />
            <ZoomControls />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </section>
  );
}
