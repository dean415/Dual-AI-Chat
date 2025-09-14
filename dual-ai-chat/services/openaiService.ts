
// Loosely based on GeminiResponsePayload for now
interface OpenAiResponsePayload {
  text: string;
  durationMs: number;
  error?: string;
}

interface OpenAiMessageContentPartText {
  type: 'text';
  text: string;
}
interface OpenAiMessageContentPartImage {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}
type OpenAiMessageContentPart = OpenAiMessageContentPartText | OpenAiMessageContentPartImage;


export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  name?: string; // optional assistant name for third-party assistant messages
  content: string | Array<OpenAiMessageContentPart>;
}

export const generateOpenAiResponse = async (
  prompt: string, // This will be the main user content for the 'user' role message
  modelId: string,
  apiKey: string,
  baseUrl: string,
  systemInstruction?: string,
  imagePart?: { mimeType: string; data: string }, // Base64 data and mimeType
  options?: {
    temperature?: number; // 0–2
    top_p?: number;       // 0–1
    reasoning_effort?: 'low' | 'medium' | 'high';
    verbosity?: 'low' | 'medium' | 'high';
  }
): Promise<OpenAiResponsePayload> => {
  const startTime = performance.now();
  const messages: OpenAiChatMessage[] = [];

  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  let userMessageContent: string | Array<OpenAiMessageContentPart>;
  if (imagePart && imagePart.data) {
    userMessageContent = [
      { type: 'text', text: prompt },
      {
        type: 'image_url',
        image_url: {
          url: `data:${imagePart.mimeType};base64,${imagePart.data}`,
          // detail: 'auto' // Optional: you can add detail if needed
        },
      },
    ];
  } else {
    userMessageContent = prompt;
  }
  messages.push({ role: 'user', content: userMessageContent });

  const requestBody: any = {
    model: modelId,
    messages: messages,
    // max_tokens: 1024, // Optional: Set a default or make it configurable
    // temperature: 0.7, // Optional
  };

  // Optional parameter passthrough (only include when defined)
  if (options) {
    if (options.temperature !== undefined) requestBody.temperature = options.temperature;
    if (options.top_p !== undefined) requestBody.top_p = options.top_p;
    if (options.reasoning_effort !== undefined) requestBody.reasoning_effort = options.reasoning_effort;
    if (options.verbosity !== undefined) requestBody.verbosity = options.verbosity;
  }

  // Debug: log final payload just before sending (when debug mode is enabled)
  try {
    if (typeof window !== 'undefined' && localStorage.getItem('dualAiChatWorkflowDebug') === 'true') {
      console.debug('[OPENAI FINAL PAYLOAD]', JSON.stringify({ model: modelId, messages }, null, 2));
    }
  } catch {}

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const durationMs = performance.now() - startTime;

    if (!response.ok) {
      let errorBody;
      try {
        errorBody = await response.json();
      } catch (e) {
        // If parsing error body fails, use status text
      }
      const errorMessage =
        errorBody?.error?.message ||
        response.statusText ||
        `请求失败，状态码: ${response.status}`;
        
      let errorType = "OpenAI API error";
      if (response.status === 401 || response.status === 403) {
        errorType = "API key invalid or permission denied";
      } else if (response.status === 429) {
        errorType = "Quota exceeded";
      }
      console.error("OpenAI API Error:", errorMessage, "Status:", response.status, "Body:", errorBody);
      return { text: errorMessage, durationMs, error: errorType };
    }

    const data = await response.json();

    if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
      console.error("OpenAI API: 无效的响应结构", data);
      return { text: "AI响应格式无效。", durationMs, error: "Invalid response structure" };
    }

    return { text: data.choices[0].message.content, durationMs };

  } catch (error) {
    console.error("调用OpenAI API时出错:", error);
    const durationMs = performance.now() - startTime;
    let errorMessage = "与AI通信时发生未知错误。";
    let errorType = "Unknown AI error";
    if (error instanceof Error) {
      errorMessage = `与AI通信时出错: ${error.message}`;
      errorType = error.name;
    }
    return { text: errorMessage, durationMs, error: errorType };
  }
};

// New: messages-based OpenAI chat call with assistant.name support
export const generateOpenAiChat = async (
  messages: OpenAiChatMessage[],
  modelId: string,
  apiKey: string,
  baseUrl: string,
  options?: {
    temperature?: number;
    top_p?: number;
    reasoning_effort?: 'low' | 'medium' | 'high';
    verbosity?: 'low' | 'medium' | 'high';
  }
): Promise<OpenAiResponsePayload> => {
  const startTime = performance.now();

  const requestBody: any = {
    model: modelId,
    messages,
  };
  try {
    if (typeof window !== 'undefined' && localStorage.getItem('dualAiChatWorkflowDebug') === 'true') {
      console.debug('[OPENAI FINAL PAYLOAD]', JSON.stringify({ model: modelId, messages }, null, 2));
    }
  } catch {}
  if (options) {
    if (options.temperature !== undefined) requestBody.temperature = options.temperature;
    if (options.top_p !== undefined) requestBody.top_p = options.top_p;
    if (options.reasoning_effort !== undefined) requestBody.reasoning_effort = options.reasoning_effort;
    if (options.verbosity !== undefined) requestBody.verbosity = options.verbosity;
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const durationMs = performance.now() - startTime;

    if (!response.ok) {
      let errorBody;
      try { errorBody = await response.json(); } catch {}
      const errorMessage =
        errorBody?.error?.message ||
        response.statusText ||
        `请求失败，状态码: ${response.status}`;
      let errorType = 'OpenAI API error';
      if (response.status === 401 || response.status === 403) errorType = 'API key invalid or permission denied';
      else if (response.status === 429) errorType = 'Quota exceeded';
      console.error('OpenAI API Error:', errorMessage, 'Status:', response.status, 'Body:', errorBody);
      return { text: errorMessage, durationMs, error: errorType };
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
      console.error('OpenAI API: 无效的响应结构', data);
      return { text: 'AI响应格式无效。', durationMs, error: 'Invalid response structure' };
    }
    return { text: data.choices[0].message.content, durationMs };
  } catch (error) {
    console.error('调用OpenAI API时出错:', error);
    const durationMs = performance.now() - startTime;
    let errorMessage = '与AI通信时发生未知错误。';
    let errorType = 'Unknown AI error';
    if (error instanceof Error) {
      errorMessage = `与AI通信时出错: ${error.message}`;
      errorType = error.name;
    }
    return { text: errorMessage, durationMs, error: errorType };
  }
};

// ========== Streaming API (Signature only; implementation in next step) ==========
export interface OpenAiChatStreamParams {
  messages: OpenAiChatMessage[];
  modelId: string;
  apiKey: string;
  baseUrl: string;
  options?: {
    temperature?: number;
    top_p?: number;
    reasoning_effort?: 'low' | 'medium' | 'high';
    verbosity?: 'low' | 'medium' | 'high';
  };
  signal?: AbortSignal; // optional external signal for cancellation
  // Streaming handlers
  onDelta?: (textChunk: string) => void;
  onDone?: (finalText: string, durationMs: number) => void;
  onError?: (error: Error) => void;
}

export interface OpenAiChatStreamHandle {
  cancel: () => void;                 // cancel the in-flight request/stream
  done: Promise<OpenAiResponsePayload>; // resolves when stream completes (or rejects on error)
}

/**
 * Streaming chat completion for OpenAI-compatible servers (SSE based).
 * NOTE: This is a placeholder signature; implementation will be added in the next step.
 */
export const generateOpenAiChatStream = (
  params: OpenAiChatStreamParams
): OpenAiChatStreamHandle => {
  const controller = new AbortController();
  // Bridge external signal if provided
  if (params.signal) {
    if (params.signal.aborted) controller.abort();
    else params.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const { messages, modelId, apiKey, baseUrl, options, onDelta, onDone, onError } = params;

  const startTime = performance.now();

  const requestBody: any = {
    model: modelId,
    messages,
    stream: true,
  };
  if (options) {
    if (options.temperature !== undefined) requestBody.temperature = options.temperature;
    if (options.top_p !== undefined) requestBody.top_p = options.top_p;
    if (options.reasoning_effort !== undefined) requestBody.reasoning_effort = options.reasoning_effort;
    if (options.verbosity !== undefined) requestBody.verbosity = options.verbosity;
  }

  const done: Promise<OpenAiResponsePayload> = (async () => {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorBody: any;
        try { errorBody = await response.json(); } catch {}
        const errorMessage =
          errorBody?.error?.message ||
          response.statusText ||
          `请求失败，状态码: ${response.status}`;
        let errorType = 'OpenAI API error';
        if (response.status === 401 || response.status === 403) errorType = 'API key invalid or permission denied';
        else if (response.status === 429) errorType = 'Quota exceeded';
        const err = new Error(errorMessage);
        try { onError && onError(err); } catch {}
        throw err;
      }

      // Ensure streaming body exists
      if (!response.body) {
        const err = new Error('Streaming not supported: response.body is null');
        try { onError && onError(err); } catch {}
        throw err;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let finalText = '';
      let streamDone = false;

      // Process a single SSE event's data payload
      const processEvent = (dataPayload: string) => {
        if (!dataPayload) return;
        if (dataPayload === '[DONE]') {
          streamDone = true;
          return;
        }
        try {
          const json = JSON.parse(dataPayload);
          const choice = Array.isArray(json?.choices) ? json.choices[0] : undefined;
          const delta = choice?.delta;
          const content: string | undefined = delta?.content;
          if (typeof content === 'string' && content.length > 0) {
            finalText += content;
            try { onDelta && onDelta(content); } catch {}
          }
        } catch (e) {
          try { onError && onError(e as Error); } catch {}
        }
      };

      // Read and parse SSE events
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunkText = decoder.decode(value, { stream: true });
        buffer += chunkText;

        while (true) {
          const idxLF = buffer.indexOf('\n\n');
          const idxCRLF = buffer.indexOf('\r\n\r\n');
          let boundary = -1;
          if (idxCRLF !== -1 && (idxLF === -1 || idxCRLF < idxLF)) boundary = idxCRLF;
          else boundary = idxLF;
          if (boundary === -1) break;

          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + (boundary === idxCRLF ? 4 : 2));
          const lines = rawEvent.split(/\r?\n/);
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
          }
          const dataPayload = dataLines.join('\n');
          processEvent(dataPayload);
          if (streamDone) break;
        }
        if (streamDone) break;
      }

      // Flush any remaining lines (no trailing boundary)
      const remaining = buffer.trim();
      if (remaining.length > 0) {
        const lines = remaining.split(/\r?\n/);
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length > 0) processEvent(dataLines.join('\n'));
      }

      const totalDuration = performance.now() - startTime;
      try { onDone && onDone(finalText, totalDuration); } catch {}
      return { text: finalText, durationMs: totalDuration };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      try { onError && onError(err); } catch {}
      throw err;
    }
  })();

  const cancel = () => controller.abort();

  return { cancel, done };
};
