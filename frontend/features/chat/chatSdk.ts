import { Citation } from "@/types";

export interface ChatSessionResponse {
  session_id: string;
  status: string;
  stream_url: string;
}

export interface ChatStreamCallbacks {
  onDelta?: (delta: string) => void;
  onCitations?: (citations: Citation[]) => void;
  onDone?: (fullMessage: string, citations: Citation[]) => void;
  onError?: (error: Error) => void;
}

export interface SendMessageOptions {
  query: string;
  use_knowledge_base?: boolean;
  top_k?: number;
  min_score?: number;
  apiEndpoint?: string;
  token?: string;
}

/**
 * Single-Route Direct SSE Streaming via Fetch & ReadableStream.
 * Recommended for Serverless (Vercel, AWS Lambda) & cloud environments.
 */
export function streamChatDirect(
  options: SendMessageOptions,
  callbacks: ChatStreamCallbacks
): () => void {
  const abortController = new AbortController();
  const endpoint = options.apiEndpoint || "/chat?stream_mode=direct";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
  };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  (async () => {
    let accumulatedText = "";
    let accumulatedCitations: Citation[] = [];

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: options.query,
          use_knowledge_base: options.use_knowledge_base ?? true,
          top_k: options.top_k ?? 3,
          min_score: options.min_score ?? 0.35,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || `HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("ReadableStream not supported by response body.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;

          const dataContent = trimmedLine.replace(/^data:\s*/, "");
          if (dataContent === "[DONE]") {
            callbacks.onDone?.(accumulatedText, accumulatedCitations);
            return;
          }

          try {
            const payload = JSON.parse(dataContent);
            if (payload.type === "delta" && payload.delta) {
              accumulatedText += payload.delta;
              callbacks.onDelta?.(payload.delta);
            } else if (payload.type === "citations" && Array.isArray(payload.citations)) {
              accumulatedCitations = payload.citations;
              callbacks.onCitations?.(accumulatedCitations);
            } else if (payload.type === "done" && payload.message) {
              accumulatedText = payload.message;
              if (payload.citations) accumulatedCitations = payload.citations;
            } else if (payload.type === "error" && payload.error) {
              throw new Error(payload.error);
            }
          } catch (e: unknown) {
            if (e instanceof Error && e.message !== dataContent) {
              // Ignore partial JSON parse errors
            }
          }
        }
      }

      callbacks.onDone?.(accumulatedText, accumulatedCitations);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name !== "AbortError") {
          callbacks.onError?.(err);
        }
      }
    }
  })();

  return () => {
    abortController.abort();
  };
}

/**
 * Step 1 of Two-Route Pattern: Dispatch query via POST to obtain session_id
 */
export async function createChatSession(
  options: SendMessageOptions
): Promise<ChatSessionResponse> {
  const endpoint = options.apiEndpoint || "/chat?stream_mode=session";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: options.query,
      use_knowledge_base: options.use_knowledge_base ?? true,
      top_k: options.top_k ?? 3,
      min_score: options.min_score ?? 0.35,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.error || errData.detail || `Failed to create chat session: ${res.status}`
    );
  }

  return (await res.json()) as ChatSessionResponse;
}

/**
 * Step 2 of Two-Route Pattern: Connect to stream_url via native EventSource
 * Compatible with any web widget, SDK, or micro-frontend without custom chunking logic.
 */
export function streamChatSession(
  streamUrl: string,
  callbacks: ChatStreamCallbacks
): () => void {
  const eventSource = new EventSource(streamUrl);
  let accumulatedText = "";
  let accumulatedCitations: Citation[] = [];

  eventSource.onmessage = (event) => {
    const rawData = event.data;
    if (rawData === "[DONE]") {
      eventSource.close();
      callbacks.onDone?.(accumulatedText, accumulatedCitations);
      return;
    }

    try {
      const payload = JSON.parse(rawData);

      if (payload.type === "citations" && Array.isArray(payload.citations)) {
        accumulatedCitations = payload.citations;
        callbacks.onCitations?.(accumulatedCitations);
      } else if (payload.type === "delta" && payload.delta) {
        accumulatedText += payload.delta;
        callbacks.onDelta?.(payload.delta);
      } else if (payload.type === "done" && payload.message) {
        accumulatedText = payload.message;
        if (payload.citations) accumulatedCitations = payload.citations;
      } else if (payload.type === "error" && payload.error) {
        throw new Error(payload.error);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        callbacks.onError?.(err);
      }
    }
  };

  eventSource.onerror = () => {
    // If the stream was already closed normally
    if (eventSource.readyState === EventSource.CLOSED) return;

    callbacks.onError?.(new Error("EventSource connection lost"));
    eventSource.close();
  };

  // Return unsubscribe/stop function
  return () => {
    eventSource.close();
  };
}
