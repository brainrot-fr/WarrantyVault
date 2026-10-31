import type { ReactNode } from 'react';

export function FlowActions({ children }: { children: ReactNode }) {
  return <div className="item-flow-actions">{children}</div>;
}
