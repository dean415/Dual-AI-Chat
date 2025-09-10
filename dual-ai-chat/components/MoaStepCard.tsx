import React, { useState } from 'react';
import { MoaStepResult } from '../types';
import { ChevronDown, ChevronRight, Loader2, XCircle, CheckCircle } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface Props {
  step: MoaStepResult;
}

const MoaStepCard: React.FC<Props> = ({ step }) => {
  const [open, setOpen] = useState(true);
  const icon = step.status === 'thinking' ? <Loader2 className="w-4 h-4 animate-spin text-sky-600"/> : step.status === 'done' ? <CheckCircle className="w-4 h-4 text-green-600"/> : <XCircle className="w-4 h-4 text-red-600"/>;
  let body: React.ReactNode = null;
  if (step.status === 'thinking') {
    body = <div className="text-xs text-gray-500">Thinking…</div>;
  } else if (step.status === 'error') {
    body = <div className="text-sm text-red-700 whitespace-pre-wrap">{step.error || '执行失败'}</div>;
  } else {
    try {
      const html = DOMPurify.sanitize(marked.parse(step.content || '') as string);
      body = <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
    } catch (e) {
      body = <pre className="text-xs bg-gray-50 border rounded p-2 overflow-auto">{step.content}</pre>;
    }
  }
  return (
    <div className="border rounded-md">
      <button onClick={()=>setOpen(o=>!o)} className="w-full flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">{open ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}{icon}<span>{step.displayName}</span></div>
        <div className="text-xs text-gray-500">{step.status}</div>
      </button>
      {open && <div className="p-2">{body}</div>}
    </div>
  );
};

export default MoaStepCard;

