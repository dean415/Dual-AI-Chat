import React from 'react';
import { ApiProviderConfig, MoeTeamPreset, MoaStepId, MoaStepResult } from '../types';
import MoaStepCard from './MoaStepCard';

interface Props {
  steps: Record<MoaStepId, MoaStepResult>;
  preset?: MoeTeamPreset;
  providersById?: Record<string, ApiProviderConfig>;
}

const order: MoaStepId[] = ['stage1A', 'stage1B', 'stage2C', 'stage2D'];

const MoaBubble: React.FC<Props> = ({ steps, preset, providersById }) => {
  const metaByStep: Record<MoaStepId, { title?: string; brand?: string; iconUrl?: string }> = preset && providersById ? {
    stage1A: { title: preset.stage1A.displayName, brand: providersById[preset.stage1A.providerId]?.brandKey, iconUrl: providersById[preset.stage1A.providerId]?.brandIconUrl },
    stage1B: { title: preset.stage1B.displayName, brand: providersById[preset.stage1B.providerId]?.brandKey, iconUrl: providersById[preset.stage1B.providerId]?.brandIconUrl },
    stage2C: { title: preset.stage2C.displayName, brand: providersById[preset.stage2C.providerId]?.brandKey, iconUrl: providersById[preset.stage2C.providerId]?.brandIconUrl },
    stage2D: { title: preset.stage2D.displayName, brand: providersById[preset.stage2D.providerId]?.brandKey, iconUrl: providersById[preset.stage2D.providerId]?.brandIconUrl },
  } as any : ({} as any);
  return (
    <div className="mb-4 w-full px-2 md:px-3 mr-auto">
      <div
        className="text-sm font-semibold mb-5"
        style={{ color: '#AEB3B9' }}
      >
        Mixture-of-Agents
      </div>
      <div className="space-y-[15px]">
        {order.map(k => steps[k] && (
          <MoaStepCard
            key={k}
            step={steps[k]}
            titleText={metaByStep[k]?.title}
            brand={metaByStep[k]?.brand as any}
            iconUrl={metaByStep[k]?.iconUrl}
          />
        ))}
      </div>
    </div>
  );
};

export default MoaBubble;
