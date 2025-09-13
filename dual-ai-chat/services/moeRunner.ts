import { ApiProviderConfig, MoeTeamPreset, RoleConfig, MoaStepResult } from '../types';
// Note: notepad content is passed directly via template variable now
import type { ProviderErrorCode } from './providerAdapter';
import { runRole } from './roleRunner';

// 模板变量约定（与 AGENT.md 的 MoE 流程一致）
export type MoeTemplateVars = {
  user_prompt: string;
  stage1_a_result?: string;
  stage1_b_result?: string;
  stage2_c_result?: string;
  stage2_d_result?: string;
  // 预留其余自定义变量
  [key: string]: string | number | boolean | undefined | null;
};

export interface MoeRunnerInput {
  // 通过 id 映射 provider，便于按 role.providerId 查找
  providersById: Record<string, ApiProviderConfig>;
  // 使用预设中的各角色配置
  preset: MoeTeamPreset;
  // 用户输入与可选图片
  userPrompt: string;
  imageApiPart?: { inlineData: { mimeType: string; data: string } };
  // 附加模板变量和模板渲染选项
  extraTemplateVars?: Record<string, string | number | boolean | undefined | null>;
  renderOptions?: { keepUnknown?: boolean };
  // 渐进更新回调：每个步骤完成后调用一次
  onStepUpdate?: (step: MoaStepResult) => void;
  // 最新记事本内容（共享记忆，不裁剪）
  notepadContent: string;
  // 上一轮用户输入
  prevUserPrompt?: string;
}

export interface SummarizerResult {
  content?: string;
  durationMs?: number;
  errorCode?: ProviderErrorCode;
  errorMessage?: string;
}

export interface MoeRunnerResult {
  stage1A: MoaStepResult;
  stage1B: MoaStepResult;
  stage2C: MoaStepResult;
  stage2D: MoaStepResult;
  summarizer: SummarizerResult;
  totalDurationMs?: number;
}

export async function runMoePipeline(input: MoeRunnerInput): Promise<MoeRunnerResult> {
  const startAll = performance.now();

  const baseVars: MoeTemplateVars = {
    user_prompt: input.userPrompt,
    user_prompt_prev1: input.prevUserPrompt || '',
    notepad_content: input.notepadContent || '',
    ...(input.extraTemplateVars || {}),
  };

  const makeStep = (id: MoaStepResult['stepId'], role: RoleConfig, status: MoaStepResult['status'], content?: string, error?: string): MoaStepResult => ({
    stepId: id,
    displayName: role.displayName,
    status,
    content,
    error,
  });

  const getProvider = (role: RoleConfig): ApiProviderConfig | undefined => input.providersById[role.providerId];

  // 取消自动注入记事本指令块逻辑，保持用户模板原样
  const ensureInjectedRole = (role: RoleConfig): RoleConfig => role;

  // R1A / R1B 并发，输入：用户消息 + 系统提示词 + 用户提示词
  const p1A = (async () => {
    const role = ensureInjectedRole(input.preset.stage1A);
    const provider = getProvider(role);
    if (!provider) return { res: makeStep('stage1A', role, 'error', undefined, `未找到 providerId=${role.providerId}`), duration: 0 };
    const r = await runRole({ provider, role, templateVars: baseVars, imageApiPart: input.imageApiPart, renderOptions: input.renderOptions });
    const out = r.errorCode
      ? { res: makeStep('stage1A', role, 'error', undefined, r.errorMessage || String(r.errorCode)), duration: r.durationMs }
      : { res: makeStep('stage1A', role, 'done', r.text), duration: r.durationMs };
    try { input.onStepUpdate?.(out.res); } catch {}
    return out;
  })();

  const p1B = (async () => {
    const role = ensureInjectedRole(input.preset.stage1B);
    const provider = getProvider(role);
    if (!provider) return { res: makeStep('stage1B', role, 'error', undefined, `未找到 providerId=${role.providerId}`), duration: 0 };
    const r = await runRole({ provider, role, templateVars: baseVars, imageApiPart: input.imageApiPart, renderOptions: input.renderOptions });
    const out = r.errorCode
      ? { res: makeStep('stage1B', role, 'error', undefined, r.errorMessage || String(r.errorCode)), duration: r.durationMs }
      : { res: makeStep('stage1B', role, 'done', r.text), duration: r.durationMs };
    try { input.onStepUpdate?.(out.res); } catch {}
    return out;
  })();

  const [{ res: r1A, duration: d1A }, { res: r1B, duration: d1B }] = await Promise.all([p1A, p1B]);

  // R2C / R2D 并发，输入：用户消息 + 系统提示词 + 用户提示词 + 对应第一轮答案
  const varsFor2C: MoeTemplateVars = {
    ...baseVars,
    stage1_a_result: r1A.content || '',
  };
  const varsFor2D: MoeTemplateVars = {
    ...baseVars,
    stage1_b_result: r1B.content || '',
  };

  const p2C = (async () => {
    const role = ensureInjectedRole(input.preset.stage2C);
    const provider = getProvider(role);
    if (!provider) return { res: makeStep('stage2C', role, 'error', undefined, `未找到 providerId=${role.providerId}`), duration: 0 };
    const r = await runRole({ provider, role, templateVars: varsFor2C, imageApiPart: input.imageApiPart, renderOptions: input.renderOptions });
    const out = r.errorCode
      ? { res: makeStep('stage2C', role, 'error', undefined, r.errorMessage || String(r.errorCode)), duration: r.durationMs }
      : { res: makeStep('stage2C', role, 'done', r.text), duration: r.durationMs };
    try { input.onStepUpdate?.(out.res); } catch {}
    return out;
  })();

  const p2D = (async () => {
    const role = ensureInjectedRole(input.preset.stage2D);
    const provider = getProvider(role);
    if (!provider) return { res: makeStep('stage2D', role, 'error', undefined, `未找到 providerId=${role.providerId}`), duration: 0 };
    const r = await runRole({ provider, role, templateVars: varsFor2D, imageApiPart: input.imageApiPart, renderOptions: input.renderOptions });
    const out = r.errorCode
      ? { res: makeStep('stage2D', role, 'error', undefined, r.errorMessage || String(r.errorCode)), duration: r.durationMs }
      : { res: makeStep('stage2D', role, 'done', r.text), duration: r.durationMs };
    try { input.onStepUpdate?.(out.res); } catch {}
    return out;
  })();

  const [{ res: r2C, duration: d2C }, { res: r2D, duration: d2D }] = await Promise.all([p2C, p2D]);

  // Summarizer，输入：用户消息 + 系统提示词 + R1A/R1B/R2C/R2D 四份答案
  const varsForSum: MoeTemplateVars = {
    ...baseVars,
    stage1_a_result: r1A.content || '',
    stage1_b_result: r1B.content || '',
    stage2_c_result: r2C.content || '',
    stage2_d_result: r2D.content || '',
  };

  const sumRole = ensureInjectedRole(input.preset.summarizer);
  const sumProvider = getProvider(sumRole);
  let summarizer: SummarizerResult;
  if (!sumProvider) {
    summarizer = { content: undefined, durationMs: 0, errorMessage: `未找到 providerId=${sumRole.providerId}` };
  } else {
    const sr = await runRole({ provider: sumProvider, role: sumRole, templateVars: varsForSum, imageApiPart: input.imageApiPart, renderOptions: input.renderOptions });
    summarizer = sr.errorCode
      ? { content: undefined, durationMs: sr.durationMs, errorCode: sr.errorCode as ProviderErrorCode, errorMessage: sr.errorMessage }
      : { content: sr.text, durationMs: sr.durationMs };
  }

  const totalDurationMs = performance.now() - startAll;
  return {
    stage1A: r1A,
    stage1B: r1B,
    stage2C: r2C,
    stage2D: r2D,
    summarizer,
    totalDurationMs,
  };
}

// 辅助：根据 role.providerId 选择 provider（签名占位）
export function selectProviderForRole(
  providersById: Record<string, ApiProviderConfig>,
  role: RoleConfig
): ApiProviderConfig | undefined {
  return providersById[role.providerId];
}
