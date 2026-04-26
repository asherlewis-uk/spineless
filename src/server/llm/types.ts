// LLM client interface and typed errors.
//
// The orchestrator depends only on this interface — never a vendor SDK.
// Concrete implementations (e.g. `openaiCompatibleClient`) plug in via DI.

import type { ZodType } from "zod";

export interface LLMChatRequest<T> {
  model: string;
  system: string;
  user: string;
  /** Zod schema validated against the parsed JSON response. */
  schema: ZodType<T>;
  /** Per-call timeout in ms. The client must enforce this. */
  timeoutMs: number;
  /** Number of additional attempts on transport-level failure. Schema errors do not retry. */
  maxRetries?: number;
  /** Optional temperature override. Defaults are chosen by the implementation. */
  temperature?: number;
}

export interface LLMClient {
  /**
   * Issue a chat-completion request constrained to JSON output, parse it,
   * and validate against `schema`. Returns the validated value or throws
   * one of the typed errors below.
   */
  chatJSON<T>(req: LLMChatRequest<T>): Promise<T>;
}

export class LLMTimeoutError extends Error {
  override readonly name = "LLMTimeoutError";
  constructor(
    message: string,
    readonly model: string,
  ) {
    super(message);
  }
}

export class LLMTransportError extends Error {
  override readonly name = "LLMTransportError";
  override readonly cause?: unknown;
  constructor(
    message: string,
    readonly model: string,
    cause?: unknown,
  ) {
    super(message);
    if (cause !== undefined) this.cause = cause;
  }
}

export class LLMSchemaError extends Error {
  override readonly name = "LLMSchemaError";
  override readonly cause?: unknown;
  constructor(
    message: string,
    readonly model: string,
    readonly raw: string,
    cause?: unknown,
  ) {
    super(message);
    if (cause !== undefined) this.cause = cause;
  }
}
