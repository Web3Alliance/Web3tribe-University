import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimitMemory } from "@/lib/rate-limit";

describe("rateLimit (in-memory backend)", () => {
  beforeEach(() => resetRateLimitMemory());

  it("allows up to the limit then blocks with a retry time", async () => {
    for (let i = 0; i < 3; i++) expect((await rateLimit("u1", 3, 60)).allowed).toBe(true);
    const blocked = await rateLimit("u1", 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
  it("counts each key separately", async () => {
    await rateLimit("a", 1, 60);
    expect((await rateLimit("a", 1, 60)).allowed).toBe(false);
    expect((await rateLimit("b", 1, 60)).allowed).toBe(true);
  });
});
