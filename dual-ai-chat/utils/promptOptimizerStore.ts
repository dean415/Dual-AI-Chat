import { load, save } from './storage';

// Local storage keys for Prompt Optimizer (scoped to this app only)
export const PROMPT_OPTIMIZER_KEYS = {
  enabled: 'dualAiChat.promptOptimizer.enabled',
  roleName: 'dualAiChat.promptOptimizer.roleName',
  n: 'dualAiChat.promptOptimizer.n',
  template: 'dualAiChat.promptOptimizer.template',
} as const;

export const PROMPT_OPTIMIZER_DEFAULTS = {
  enabled: false,
  roleName: '',
  n: 6,
  template:
    '请基于最近对话与当前输入，保持用户语言与意图一致，输出可直接发送的高质量提示词。最近上下文：{{recent_mixed_messages}}\n当前输入：{{current_input}}',
};

export function getOptimizerEnabled(): boolean {
  return load<boolean>(PROMPT_OPTIMIZER_KEYS.enabled, PROMPT_OPTIMIZER_DEFAULTS.enabled);
}

export function setOptimizerEnabled(v: boolean) {
  save(PROMPT_OPTIMIZER_KEYS.enabled, !!v);
}

export function getOptimizerRoleName(): string {
  return load<string>(PROMPT_OPTIMIZER_KEYS.roleName, PROMPT_OPTIMIZER_DEFAULTS.roleName) || '';
}

export function setOptimizerRoleName(name: string) {
  save(PROMPT_OPTIMIZER_KEYS.roleName, String(name || ''));
}

export function getOptimizerN(): number {
  const raw = load<number | string>(PROMPT_OPTIMIZER_KEYS.n, PROMPT_OPTIMIZER_DEFAULTS.n as any);
  const num = typeof raw === 'string' ? parseInt(raw, 10) : (typeof raw === 'number' ? raw : PROMPT_OPTIMIZER_DEFAULTS.n);
  // Clamp to [1, 50]
  const clamped = Math.max(1, Math.min(50, isNaN(num as any) ? PROMPT_OPTIMIZER_DEFAULTS.n : (num as number)));
  return clamped;
}

export function setOptimizerN(n: number) {
  const num = Math.max(1, Math.min(50, Number(n) || PROMPT_OPTIMIZER_DEFAULTS.n));
  save(PROMPT_OPTIMIZER_KEYS.n, num);
}

export function getOptimizerTemplate(): string {
  const tpl = load<string>(PROMPT_OPTIMIZER_KEYS.template, PROMPT_OPTIMIZER_DEFAULTS.template) || '';
  return tpl;
}

export function setOptimizerTemplate(tpl: string) {
  save(PROMPT_OPTIMIZER_KEYS.template, String(tpl || ''));
}

