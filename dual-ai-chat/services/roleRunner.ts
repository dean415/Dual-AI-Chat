import { ApiProviderConfig, RoleConfig } from '../types';
import { renderTemplate } from '../utils/appUtils';
import type { ProviderErrorCode } from './providerAdapter';
import { callModel } from './providerAdapter';

export interface RoleRunnerInput {
  provider: ApiProviderConfig;
  role: RoleConfig;
  templateVars?: Record<string, string | number | boolean | undefined | null>;
  imageApiPart?: { inlineData: { mimeType: string; data: string } };
  renderOptions?: { keepUnknown?: boolean };
}

export interface RoleRunnerResult {
  text: string;
  durationMs: number;
  errorCode?: ProviderErrorCode;
  errorMessage?: string;
}

export function renderRoleUserPrompt(
  role: RoleConfig,
  vars: RoleRunnerInput['templateVars'] = {},
  options?: RoleRunnerInput['renderOptions']
): string {
  const tpl = role.userPromptTemplate || '';
  return renderTemplate(tpl, vars || {}, options);
}

export async function runRole(_input: RoleRunnerInput): Promise<RoleRunnerResult> {
  const { provider, role, templateVars, imageApiPart, renderOptions } = _input;
  const userPrompt = renderRoleUserPrompt(role, templateVars, renderOptions);
  const systemPrompt = role.systemPrompt;
  const parameters = role.parameters;

  const res = await callModel({
    provider,
    modelId: role.modelId,
    systemPrompt,
    userPrompt,
    imageApiPart,
    parameters,
  });

  return {
    text: res.text,
    durationMs: res.durationMs,
    errorCode: res.errorCode,
    errorMessage: res.errorMessage,
  };
}
