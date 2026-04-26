// OpenAI-compatible chat-completions client.
// Works against any provider that exposes the OpenAI chat-completions schema:
// Ollama Cloud, OpenRouter, vLLM, OpenAI itself.
//
// Configuration via env / constructor options. No vendor lock-in.

import {
  LLMSchemaError,
  LLMTimeoutError,
  LLMTransportError,
  type LLMChatRequest,
  type LLMClient,
} from "./types.js";

export interface OpenAICompatibleClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Default per-request timeout in ms if the call does not specify one. */
  defaultTimeoutMs?: number;
  /** Injected for testing. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
}

export class OpenAICompatibleClient implements LLMClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OpenAICompatibleClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 30_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async chatJSON<T>(req: LLMChatRequest<T>): Promise<T> {
    const maxRetries = req.maxRetries ?? 1;
    let lastTransportError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let raw: string;
      try {
        raw = await this.callOnce(req);
      } catch (err) {
        if (err instanceof LLMTimeoutError) throw err;
        lastTransportError = err;
        continue; // retry transport failures only
      }

      // Schema errors do not retry — model returned valid transport but bad shape.
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new LLMSchemaError(
          `Model ${req.model} returned non-JSON response.`,
          req.model,
          raw,
          err,
        );
      }

      const result = req.schema.safeParse(parsed);
      if (!result.success) {
        throw new LLMSchemaError(
          `Model ${req.model} returned JSON that failed schema validation.`,
          req.model,
          raw,
          result.error,
        );
      }
      return result.data;
    }

    throw new LLMTransportError(
      `Model ${req.model} transport failed after ${maxRetries + 1} attempts.`,
      req.model,
      lastTransportError,
    );
  }

  private async callOnce<T>(req: LLMChatRequest<T>): Promise<string> {
    const timeoutMs = req.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: req.model,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          temperature: req.temperature ?? 0.2,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new LLMTransportError(
          `Model ${req.model} returned HTTP ${res.status}: ${body.slice(0, 500)}`,
          req.model,
        );
      }

      const json = (await res.json()) as ChatCompletionResponse;
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.length === 0) {
        throw new LLMSchemaError(
          `Model ${req.model} returned empty content.`,
          req.model,
          JSON.stringify(json).slice(0, 500),
        );
      }
      return content;
    } catch (err) {
      if (err instanceof LLMSchemaError) throw err;
      if (err instanceof LLMTransportError) throw err;
      if (
        err instanceof Error &&
        (err.name === "AbortError" || /abort/i.test(err.message))
      ) {
        throw new LLMTimeoutError(
          `Model ${req.model} timed out after ${timeoutMs}ms.`,
          req.model,
        );
      }
      throw new LLMTransportError(
        `Model ${req.model} transport error: ${(err as Error).message ?? "unknown"}`,
        req.model,
        err,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
