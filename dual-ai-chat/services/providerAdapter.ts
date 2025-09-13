import { ApiProviderConfig, RoleParameters } from '../types';
import { generateResponse as generateGeminiResponse } from './geminiService';
import { generateOpenAiResponse, generateOpenAiChat, OpenAiChatMessage } from './openaiService';

export type TestConnectionResult = { ok: boolean; latencyMs: number; message?: string };

export async function testConnection(provider: ApiProviderConfig): Promise<TestConnectionResult> {
  const start = performance.now();
  try {
    if (provider.providerType === 'openai') {
      if (!provider.baseUrl) {
        return { ok: false, latencyMs: 0, message: '缺少 baseUrl' };
      }
      const res = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/models`, {
        headers: provider.apiKey ? { 'Authorization': `Bearer ${provider.apiKey}` } : undefined,
      });
      const latencyMs = performance.now() - start;
      if (!res.ok) {
        let msg = res.statusText;
        try { const body = await res.json(); msg = body?.error?.message || msg; } catch {}
        return { ok: false, latencyMs, message: msg };
      }
      return { ok: true, latencyMs };
    }

    // Gemini
    const base = (provider.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
    if (!provider.apiKey) {
      // In env-based mode we cannot read process.env from browser; return informative status
      return { ok: false, latencyMs: 0, message: '缺少 API Key（或使用环境变量模式，无法在浏览器侧验证）' };
    }
    const url = `${base}/models?key=${encodeURIComponent(provider.apiKey)}`;
    const res = await fetch(url);
    const latencyMs = performance.now() - start;
    if (!res.ok) {
      let msg = res.statusText;
      try { const body = await res.json(); msg = body?.error?.message || msg; } catch {}
      return { ok: false, latencyMs, message: msg };
    }
    return { ok: true, latencyMs };
  } catch (e) {
    const latencyMs = performance.now() - start;
    return { ok: false, latencyMs, message: e instanceof Error ? e.message : '未知错误' };
  }
}

export type ProviderErrorCode =
  | 'API_KEY_MISSING'
  | 'PERMISSION_DENIED'
  | 'QUOTA_EXCEEDED'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'INVALID_REQUEST'
  | 'UNKNOWN';

function mapErrorToCode(err?: string): ProviderErrorCode | undefined {
  if (!err) return undefined;
  const e = err.toLowerCase();
  if (e.includes('not configured') || e.includes('not provided') || e.includes('missing')) return 'API_KEY_MISSING';
  if (e.includes('invalid') || e.includes('permission')) return 'PERMISSION_DENIED';
  if (e.includes('quota')) return 'QUOTA_EXCEEDED';
  if (e.includes('timeout')) return 'TIMEOUT';
  if (e.includes('network') || e.includes('fetch')) return 'NETWORK';
  if (e.includes('invalid request') || e.includes('invalid response structure')) return 'INVALID_REQUEST';
  return 'UNKNOWN';
}

export function friendlyMessageFor(code: ProviderErrorCode): string {
  switch (code) {
    case 'API_KEY_MISSING': return 'API 密钥缺失，请在设置中配置。';
    case 'PERMISSION_DENIED': return 'API 密钥无效或权限不足。';
    case 'QUOTA_EXCEEDED': return 'API 配额已用尽，请稍后重试。';
    case 'TIMEOUT': return '请求超时，请检查网络或稍后重试。';
    case 'NETWORK': return '网络错误，无法连接到服务。';
    case 'INVALID_REQUEST': return '请求参数无效或响应结构异常。';
    default: return '未知错误';
  }
}

export async function callModel(args: {
  provider: ApiProviderConfig;
  modelId: string;
  systemPrompt?: string;
  userPrompt: string;
  imageApiPart?: { inlineData: { mimeType: string; data: string } };
  parameters?: RoleParameters;
}): Promise<{ text: string; durationMs: number; errorCode?: ProviderErrorCode; errorMessage?: string }>
{
  const { provider, modelId, systemPrompt, userPrompt, imageApiPart, parameters } = args;
  if (provider.providerType === 'openai') {
    const res = await generateOpenAiResponse(
      userPrompt,
      modelId,
      provider.apiKey || '',
      (provider.baseUrl || '').replace(/\/$/, ''),
      systemPrompt,
      imageApiPart ? { mimeType: imageApiPart.inlineData.mimeType, data: imageApiPart.inlineData.data } : undefined,
      parameters
    );
    const code = mapErrorToCode(res.error);
    return { text: res.text, durationMs: res.durationMs, errorCode: code, errorMessage: res.error ? res.text : undefined };
  }
  // Gemini
  const useCustom = !!(provider.apiKey || provider.baseUrl);
  const res = await generateGeminiResponse(
    userPrompt,
    modelId,
    useCustom,
    provider.apiKey,
    provider.baseUrl,
    systemPrompt,
    imageApiPart,
    undefined,
    parameters
  );
  const code = mapErrorToCode(res.error);
  return { text: res.text, durationMs: res.durationMs, errorCode: code, errorMessage: res.error ? res.text : undefined };
}

// New: messages-based model call (OpenAI-compatible only)
export async function callModelWithMessages(args: {
  provider: ApiProviderConfig;
  modelId: string;
  messages: OpenAiChatMessage[];
  parameters?: RoleParameters;
}): Promise<{ text: string; durationMs: number; errorCode?: ProviderErrorCode; errorMessage?: string }>
{
  const { provider, modelId, messages, parameters } = args;
  if (provider.providerType !== 'openai') {
    // Non-OpenAI providers are not supported in messages-based path for MVP
    return { text: 'Only OpenAI-compatible providers support messages-based workflow in this version.', durationMs: 0, errorCode: 'INVALID_REQUEST', errorMessage: 'unsupported provider' };
  }
  const res = await generateOpenAiChat(
    messages,
    modelId,
    provider.apiKey || '',
    (provider.baseUrl || '').replace(/\/$/, ''),
    parameters
  );
  const code = mapErrorToCode(res.error);
  return { text: res.text, durationMs: res.durationMs, errorCode: code, errorMessage: res.error ? res.text : undefined };
}
