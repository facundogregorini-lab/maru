import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

const models: string[] = [];

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class NotFoundError extends APIError {}
  class BadRequestError extends APIError {}
  class RateLimitError extends APIError {}
  class AuthenticationError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static NotFoundError = NotFoundError;
    static BadRequestError = BadRequestError;
    static RateLimitError = RateLimitError;
    static AuthenticationError = AuthenticationError;
    beta = {
      messages: {
        parse: async ({ model }: { model: string }) => {
          models.push(model);
          if (model === "modelo-que-no-existe") throw new NotFoundError("model: modelo-que-no-existe");
          return { stop_reason: "end_turn", parsed_output: { ok: true } };
        },
      },
    };
  }
  return { default: Anthropic };
});

describe("modelo rápido", () => {
  it("si la cuenta no tiene el modelo rápido, usa el principal", async () => {
    const { askStructured } = await import("@/lib/claude");
    const out = await askStructured({ system: "s", content: [{ type: "text", text: "hola" }], schema: z.object({ ok: z.boolean() }), effort: "low", model: "modelo-que-no-existe" });
    expect(out).toEqual({ ok: true });
    expect(models).toEqual(["modelo-que-no-existe", process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5"]);
  });
});
