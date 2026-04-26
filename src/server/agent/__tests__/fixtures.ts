// Test fixtures and a stub LLMClient that lets each test enqueue typed responses
// per-model.

import type { ZodType } from "zod";
import type {
  Card,
  ImpactAnalysisResult,
  SpineGraph,
} from "../../../contracts/index.js";
import type { LLMChatRequest, LLMClient } from "../../llm/types.js";

type Responder = (
  req: LLMChatRequest<unknown>,
) => unknown | Promise<unknown> | (() => never);

export class StubLLMClient implements LLMClient {
  private queues = new Map<string, Responder[]>();
  public calls: Array<{ model: string; system: string; user: string }> = [];

  enqueue(model: string, responder: Responder): void {
    const q = this.queues.get(model) ?? [];
    q.push(responder);
    this.queues.set(model, q);
  }

  async chatJSON<T>(req: LLMChatRequest<T>): Promise<T> {
    this.calls.push({ model: req.model, system: req.system, user: req.user });
    const q = this.queues.get(req.model);
    if (!q || q.length === 0) {
      throw new Error(
        `StubLLMClient: no responder queued for model ${req.model}`,
      );
    }
    const responder = q.shift()!;
    const value = await responder(req as LLMChatRequest<unknown>);
    // Allow responders to throw by returning a thunk.
    if (typeof value === "function") {
      (value as () => never)();
    }
    const parsed = (req.schema as ZodType<T>).safeParse(value);
    if (!parsed.success) {
      // Surface as if it were a real schema failure.
      throw new Error(
        `StubLLMClient: queued value failed schema: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }
}

export function makeCard(
  overrides: Partial<Card> & Pick<Card, "id" | "type">,
): Card {
  return {
    state: "idle",
    config: {},
    ports: [],
    position: { depth: 0, track: 0, zOffset: 0 },
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

export function makeSpineGraph(opts?: {
  id?: string;
  version?: number;
  cards?: Card[];
}): SpineGraph {
  const cards = opts?.cards ?? [
    makeCard({ id: "input-1", type: "input" }),
    makeCard({ id: "prompt-1", type: "prompt" }),
  ];
  return {
    id: opts?.id ?? "spine-1",
    version: opts?.version ?? 1,
    updatedAt: 0,
    executionOrder: cards.map((c) => c.id),
    cards: Object.fromEntries(cards.map((c) => [c.id, c])),
    connections: {},
  };
}

export function makeImpact(triggeredBy: string): ImpactAnalysisResult {
  return {
    triggeredBy,
    affected: [],
    suggestions: [],
    hasUnresolvable: false,
  };
}
