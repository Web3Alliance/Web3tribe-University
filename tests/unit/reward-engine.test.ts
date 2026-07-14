import { describe, it, expect, vi } from "vitest";
import { getRewardEngine } from "@/lib/reward-engine";

function makeMockSupabase(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === "award_w3tr") {
        return {
          data: {
            id: "tx-1",
            profile_id: args.p_profile_id,
            type: args.p_type,
            amount: args.p_amount,
            balance_after: 100,
            reference_table: args.p_reference_table,
            reference_id: args.p_reference_id,
            description: args.p_description,
            awarded_by: args.p_awarded_by,
            created_at: new Date().toISOString(),
          },
          error: null,
        };
      }
      if (fn === "spend_w3tr") {
        return {
          data: {
            id: "tx-2",
            profile_id: args.p_profile_id,
            type: "spend",
            amount: -Number(args.p_amount),
            balance_after: 50,
            created_at: new Date().toISOString(),
          },
          error: null,
        };
      }
      if (fn === "complete_lesson") {
        return { data: null, error: null };
      }
      if (fn === "record_daily_login") {
        return { data: [{ streak_day: 3, w3tr_awarded: 2 }], error: null };
      }
      return { data: null, error: { message: `Unknown RPC ${fn}` } };
    }),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(async () => ({ data: { profile_id: "p1", balance: 42, lifetime_earned: 100, lifetime_spent: 58, updated_at: "now" }, error: null })),
    })),
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("RewardEngine.award", () => {
  it("calls the award_w3tr RPC with the correct arguments and returns the transaction", async () => {
    const supabase = makeMockSupabase();
    const engine = getRewardEngine(supabase);

    const tx = await engine.award("user-1", "lesson_complete", 5, {
      referenceTable: "lessons",
      referenceId: "lesson-1",
      description: "Completed lesson 1",
    });

    expect(supabase.rpc).toHaveBeenCalledWith("award_w3tr", {
      p_profile_id: "user-1",
      p_type: "lesson_complete",
      p_amount: 5,
      p_reference_table: "lessons",
      p_reference_id: "lesson-1",
      p_description: "Completed lesson 1",
      p_awarded_by: null,
    });
    expect(tx.amount).toBe(5);
    expect(tx.profile_id).toBe("user-1");
  });

  it("throws a descriptive error when the RPC fails", async () => {
    const supabase = makeMockSupabase();
    supabase.rpc = vi.fn(async () => ({ data: null, error: { message: "resulting balance cannot be negative" } }));
    const engine = getRewardEngine(supabase);

    await expect(engine.award("user-1", "admin_deduction", -1000)).rejects.toThrow(
      /resulting balance cannot be negative/
    );
  });
});

describe("RewardEngine.spend", () => {
  it("calls spend_w3tr with a positive amount and receives a negative-amount transaction back", async () => {
    const supabase = makeMockSupabase();
    const engine = getRewardEngine(supabase);

    const tx = await engine.spend("user-1", 20, { description: "Redeemed for a badge" });

    expect(supabase.rpc).toHaveBeenCalledWith("spend_w3tr", {
      p_profile_id: "user-1",
      p_amount: 20,
      p_reference_table: null,
      p_reference_id: null,
      p_description: "Redeemed for a badge",
    });
    expect(tx.amount).toBe(-20);
  });
});

describe("RewardEngine.getBalance", () => {
  it("returns the wallet for a given profile", async () => {
    const supabase = makeMockSupabase();
    const engine = getRewardEngine(supabase);

    const wallet = await engine.getBalance("user-1");
    expect(wallet?.balance).toBe(42);
  });
});

describe("RewardEngine.completeLesson", () => {
  it("calls the complete_lesson RPC with enrollment and lesson ids", async () => {
    const supabase = makeMockSupabase();
    const engine = getRewardEngine(supabase);

    await engine.completeLesson("enrollment-1", "lesson-1");

    expect(supabase.rpc).toHaveBeenCalledWith("complete_lesson", {
      p_enrollment_id: "enrollment-1",
      p_lesson_id: "lesson-1",
    });
  });
});

describe("RewardEngine.recordDailyLogin", () => {
  it("returns the streak day and awarded amount", async () => {
    const supabase = makeMockSupabase();
    const engine = getRewardEngine(supabase);

    const result = await engine.recordDailyLogin("user-1");
    expect(result).toEqual({ streak_day: 3, w3tr_awarded: 2 });
  });
});
