import React from 'react';
import { MoaStepId, MoaStepResult } from '../types';
import MoaStepCard from './MoaStepCard';

interface Props {
  steps: Record<MoaStepId, MoaStepResult>;
}

const order: MoaStepId[] = ['stage1A', 'stage1B', 'stage2C', 'stage2D'];

const MoaBubble: React.FC<Props> = ({ steps }) => {
  return (
    <div className="mb-4 p-3 rounded-lg shadow-md max-w-2xl mr-auto border bg-white">
      <div className="text-sm font-semibold text-gray-700 mb-2">MoE 并行执行</div>
      <div className="space-y-2">
        {order.map(k => steps[k] && <MoaStepCard key={k} step={steps[k]} />)}
      </div>
    </div>
  );
};

export default MoaBubble;

