import React, { useMemo, useState } from 'react';
import { ApiProviderConfig, ProviderCapabilities, ProviderType } from '../types';

interface Props {
  initial?: Partial<ApiProviderConfig>;
  onCancel: () => void;
  onSave: (cfg: ApiProviderConfig) => void;
}

const emptyCaps: ProviderCapabilities = { supportsSystemInstruction: true, supportsImages: true, supportsThinkingConfig: true };

export const ApiChannelForm: React.FC<Props> = ({ initial, onCancel, onSave }) => {
  const [name, setName] = useState(initial?.name || '');
  const [providerType, setProviderType] = useState<ProviderType>(initial?.providerType || 'gemini');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl || '');
  const [apiKey, setApiKey] = useState(initial?.apiKey || '');
  const [defaultModel, setDefaultModel] = useState(initial?.defaultModel || '');
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(initial?.timeoutSeconds || 60);
  const [caps, setCaps] = useState<ProviderCapabilities>(initial?.capabilities || emptyCaps);
  const [error, setError] = useState<string | null>(null);

  const isOpenAi = providerType === 'openai';

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (isOpenAi && !baseUrl.trim()) return false;
    return true;
  }, [name, isOpenAi, baseUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canSave) {
      setError('请填写必填项');
      return;
    }
    const id = initial?.id || `provider-${Date.now()}`;
    onSave({ id, name: name.trim(), providerType, baseUrl: baseUrl.trim() || undefined, apiKey: apiKey.trim() || undefined, defaultModel: defaultModel.trim() || undefined, timeoutSeconds, capabilities: caps });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">名称
          <input className="mt-1 w-full border border-gray-300 rounded p-1.5" value={name} onChange={e => setName(e.target.value)} placeholder="例如 Gemini (自定义)" />
        </label>
        <label className="text-sm">类型
          <select className="mt-1 w-full border border-gray-300 rounded p-1.5" value={providerType} onChange={e => setProviderType(e.target.value as ProviderType)}>
            <option value="gemini">gemini</option>
            <option value="openai">openai</option>
          </select>
        </label>
        <label className="text-sm col-span-2">Base URL（OpenAI 兼容必填）
          <input className="mt-1 w-full border border-gray-300 rounded p-1.5" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder={isOpenAi ? 'http://localhost:11434/v1' : '留空使用默认'} />
        </label>
        <label className="text-sm col-span-2">API Key（可选）
          <input className="mt-1 w-full border border-gray-300 rounded p-1.5" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="在浏览器中保存，请谨慎" />
        </label>
        <label className="text-sm">默认模型
          <input className="mt-1 w-full border border-gray-300 rounded p-1.5" value={defaultModel} onChange={e => setDefaultModel(e.target.value)} placeholder="例如 gemini-2.5-pro 或 llama3" />
        </label>
        <label className="text-sm">超时（秒）
          <input type="number" min={5} className="mt-1 w-full border border-gray-300 rounded p-1.5" value={timeoutSeconds} onChange={e => setTimeoutSeconds(parseInt(e.target.value, 10) || 60)} />
        </label>
      </div>
      <fieldset className="border border-gray-200 rounded p-2">
        <legend className="text-xs text-gray-600">能力</legend>
        <label className="inline-flex items-center mr-4 text-sm">
          <input type="checkbox" className="mr-1" checked={!!caps.supportsSystemInstruction} onChange={e => setCaps(c => ({ ...c, supportsSystemInstruction: e.target.checked }))} /> systemInstruction
        </label>
        <label className="inline-flex items-center mr-4 text-sm">
          <input type="checkbox" className="mr-1" checked={!!caps.supportsImages} onChange={e => setCaps(c => ({ ...c, supportsImages: e.target.checked }))} /> images
        </label>
        <label className="inline-flex items-center text-sm">
          <input type="checkbox" className="mr-1" checked={!!caps.supportsThinkingConfig} onChange={e => setCaps(c => ({ ...c, supportsThinkingConfig: e.target.checked }))} /> thinkingConfig
        </label>
      </fieldset>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 border rounded">取消</button>
        <button type="submit" disabled={!canSave} className="px-3 py-1.5 bg-sky-600 text-white rounded disabled:opacity-50">保存</button>
      </div>
    </form>
  );
};

export default ApiChannelForm;

