import React, { useState } from 'react';
import { MoaStepResult, BrandKey } from '../types';
import { ChevronDown, XCircle } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TwoDotsSpinner from './TwoDotsSpinner';
import ThinkingAnimated from './ThinkingAnimated';
import BrandIcon from './BrandIcon';
import GreenCheckBadge from './GreenCheckBadge';
import { useAppStore } from '../store/appStore';
import { TeamPreset } from '../types';

interface Props {
  step: MoaStepResult;
  titleText?: string;
  brand?: BrandKey;
  iconUrl?: string; // optional custom provider icon
  showDebug?: boolean;
  debugPreview?: Array<{ role: string; name?: string; content: string }>;
}

const MoaStepCard: React.FC<Props> = ({ step, titleText, brand, iconUrl, showDebug, debugPreview }) => {
  // Fallback: derive brand/title from active team + providers if not provided
  const { state } = useAppStore();
  let providerIconUrl: string | undefined = iconUrl;
  if (!titleText || !brand) {
    const activeTeam: TeamPreset | undefined = state.teamPresets.find(t => t.id === state.activeTeamId);
    if (activeTeam && activeTeam.mode === 'moe') {
      const moe = activeTeam as any;
      const role = step.stepId === 'stage1A' ? moe.stage1A : step.stepId === 'stage1B' ? moe.stage1B : step.stepId === 'stage2C' ? moe.stage2C : moe.stage2D;
      titleText = titleText || role?.displayName || role?.modelId;
      const p = state.apiProviders.find(x => x.id === role?.providerId);
      brand = brand || (p && (p.brandKey as BrandKey));
      providerIconUrl = providerIconUrl || p?.brandIconUrl;
    }
  }
  const [open, setOpen] = useState(true);
  const statusSize = 20; // thinking check size (green badge)
  const brandSize = 24;  // brand logo size
  const icon = step.status === 'thinking'
    ? <TwoDotsSpinner durationMs={1000} smallDiameter={8} bigDiameter={16} />
    : step.status === 'done'
      ? <GreenCheckBadge size={statusSize} />
      : <XCircle className="w-4 h-4 text-red-600"/>;
  let body: React.ReactNode = null;
  if (step.status === 'thinking') {
    body = (
      <div className="text-[20px] text-gray-800 serif-text leading-none">
        <ThinkingAnimated sizePx={20} />
      </div>
    );
  } else if (step.status === 'error') {
    body = <div className="text-sm text-red-700 whitespace-pre-wrap">{step.error || '执行失败'}</div>;
  } else {
    try {
      const html = DOMPurify.sanitize(marked.parse(step.content || '') as string);
      body = <div className="prose prose-sm max-w-none serif-text" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (e) {
      body = <pre className="text-xs bg-gray-50 border rounded p-2 overflow-auto">{step.content}</pre>;
    }
  }
  const [debugOpen, setDebugOpen] = useState(false);
  const minifyPreview = (arr?: Array<{ role: string; name?: string; content: string }>) => {
    if (!arr || arr.length === 0) return '';
    const items = arr.map(m => ({ role: m.role, ...(m.name ? { name: m.name } : {}), content: m.content }));
    return JSON.stringify(items);
  };
  const singleLine = minifyPreview(debugPreview);

  return (
    <div className="border rounded-[14px] border-[#E6E8EB]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between pr-[15px] pl-[20px] py-[10px] bg-white rounded-[14px]"
        aria-expanded={open}
        aria-label={`展开或收起 ${titleText || step.displayName}`}
      >
        <div className="flex items-center gap-4 text-sm font-medium text-gray-700 leading-none">
          {icon}
          <BrandIcon brand={brand} src={providerIconUrl} size={brandSize} />
          <span className="ml-0.5 text-[20px] serif-text">{titleText || step.displayName}</span>
        </div>
        <div className="flex items-center gap-3">
          {showDebug && singleLine && (
            <button
              type="button"
              onClick={(e)=>{ e.stopPropagation(); setDebugOpen(v=>!v); }}
              title="Debug"
              className="text-xs text-gray-400 hover:text-gray-600 font-mono"
            >
              Debug: {singleLine}
            </button>
          )}
          <div className="rounded-full bg-[#F1F3F5] flex items-center justify-center" style={{ width: 24, height: 24 }}>
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`} />
          </div>
        </div>
      </button>
      {debugOpen && showDebug && singleLine && (
        <div className="px-4 pt-1 pb-2 bg-white border-t border-gray-100">
          <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap">---
{JSON.stringify(debugPreview, null, 2)}
---</pre>
        </div>
      )}
      {open && <div className="p-2 bg-white">{body}</div>}
    </div>
  );
};

export default MoaStepCard;
