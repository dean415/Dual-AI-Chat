import { useCallback, useRef, useState } from 'react';
import { ApiProviderConfig, MoeTeamPreset, MoaStepId, MoaStepResult } from '../types';
import { runMoePipeline, SummarizerResult } from '../services/moeRunner';

export interface UseMoeLogicProps {
  providersById: Record<string, ApiProviderConfig>;
  preset: MoeTeamPreset;
  onSummarizerReady?: (result: SummarizerResult) => void;
  notepadContent?: string; // latest notebook shared memory
}

export interface UseMoeLogicResult {
  isRunning: boolean;
  stepsState: Record<MoaStepId, MoaStepResult>;
  startMoeProcessing: (
    userText: string,
    imageApiPart?: { inlineData: { mimeType: string; data: string } }
  ) => Promise<void>;
  stopGenerating: () => void;
  resetMoeMemory: () => void;
}

const emptyStep = (id: MoaStepId, displayName = ''): MoaStepResult => ({
  stepId: id,
  displayName,
  status: 'thinking',
});

export function useMoeLogic({ providersById, preset, onSummarizerReady, notepadContent }: UseMoeLogicProps): UseMoeLogicResult {
  const cancelRef = useRef(false);
  const prevUserPromptRef = useRef<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [stepsState, setStepsState] = useState<Record<MoaStepId, MoaStepResult>>({
    stage1A: emptyStep('stage1A', preset.stage1A.displayName),
    stage1B: emptyStep('stage1B', preset.stage1B.displayName),
    stage2C: emptyStep('stage2C', preset.stage2C.displayName),
    stage2D: emptyStep('stage2D', preset.stage2D.displayName),
  });

  const stopGenerating = useCallback(() => {
    cancelRef.current = true;
    setIsRunning(false);
  }, []);

  const startMoeProcessing = useCallback<UseMoeLogicResult['startMoeProcessing']>(
    async (userText, imageApiPart) => {
      if (isRunning) return; // 避免重复启动，简化处理
      cancelRef.current = false;
      setIsRunning(true);
      // 重置四个步骤为 thinking
      setStepsState({
        stage1A: emptyStep('stage1A', preset.stage1A.displayName),
        stage1B: emptyStep('stage1B', preset.stage1B.displayName),
        stage2C: emptyStep('stage2C', preset.stage2C.displayName),
        stage2D: emptyStep('stage2D', preset.stage2D.displayName),
      });

      try {
        // 读取上一轮，再立刻更新为当前输入（用于下一轮）
        const prevForThisRun = prevUserPromptRef.current;
        prevUserPromptRef.current = userText;
        const result = await runMoePipeline({
          providersById,
          preset,
          userPrompt: userText,
          imageApiPart,
          notepadContent: notepadContent || '',
          prevUserPrompt: prevForThisRun,
          onStepUpdate: (step) => {
            if (cancelRef.current) return; // 取消时丢弃
            // 渐进更新：仅覆盖对应步骤
            setStepsState(prev => ({ ...prev, [step.stepId]: step } as Record<MoaStepId, MoaStepResult>));
          },
        });
        if (cancelRef.current) return; // 取消后不落盘状态

        setStepsState({
          stage1A: result.stage1A,
          stage1B: result.stage1B,
          stage2C: result.stage2C,
          stage2D: result.stage2D,
        });
        onSummarizerReady?.(result.summarizer);
      } finally {
        setIsRunning(false);
      }
    },
    [isRunning, providersById, preset, onSummarizerReady, notepadContent]
  );

  const resetMoeMemory = useCallback(() => {
    prevUserPromptRef.current = '';
  }, []);

  return { isRunning, stepsState, startMoeProcessing, stopGenerating, resetMoeMemory };
}
