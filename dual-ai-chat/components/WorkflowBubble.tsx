import React from 'react';
import MoaStepCard from './MoaStepCard';
import type { BrandKey } from '../types';

export type WorkflowStepView = {
  roleName: string;
  titleText?: string;
  brand?: BrandKey;
  iconUrl?: string;
  debugPreview?: Array<{ role: string; name?: string; content: string }>;
  status: 'thinking' | 'done' | 'error';
  content?: string;
  error?: string;
};

export interface WorkflowRoundView {
  steps: WorkflowStepView[];
}

interface Props {
  rounds: WorkflowRoundView[];
  title?: string;
  showDebug?: boolean;
  showTypingCaret?: boolean;
}

const WorkflowBubble: React.FC<Props> = ({ rounds, title, showDebug, showTypingCaret }) => {
  return (
    <div className="mb-4 w-full px-2 md:px-3 mr-auto">
      <div className="text-sm font-semibold mb-3" style={{ color: '#AEB3B9' }}>
        {title || 'Workflow'}
      </div>
      <div className="space-y-5">
        {rounds.map((round, idx) => (
          <div key={`wf-round-${idx}`} className="space-y-[12px]">
            <div className="text-xs text-gray-500">Round {idx + 1}</div>
            {round.steps.map((s, i) => (
              <MoaStepCard
                key={`wf-step-${idx}-${i}`}
                step={{ stepId: 'stage1A', displayName: s.roleName, status: s.status, content: s.content, error: s.error } as any}
                titleText={s.titleText || s.roleName}
                brand={s.brand}
                iconUrl={s.iconUrl}
                showDebug={showDebug}
                debugPreview={(s as any).debugPreview}
                showTypingCaret={showTypingCaret}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkflowBubble;
