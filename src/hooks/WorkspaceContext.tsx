import { createContext, useContext } from 'react';
import type { Workspace } from './useWorkspace';
import type { EditorTarget } from '../components/EntityEditor';
export type WorkspaceActions = {
  data: Workspace;
  edit: (target: EditorTarget) => void;
  remove: (target: EditorTarget) => void;
};
export const WorkspaceContext = createContext<WorkspaceActions | null>(null);
export function useNexus() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('O espaço de trabalho ainda não está disponível.');
  return value;
}
