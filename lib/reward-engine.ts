import type { SupabaseClient } from "@supabase/supabase-js";
import type { W3trTransaction, W3trTransactionType, W3trWallet } from "@/lib/types";

/**
 * REWARD ENGINE — MODULAR ADAPTER INTERFACE
 * =====================================================================================
 * W3TR is currently implemented as a plain, off-chain relational ledger (see the
 * `w3tr_wallets` / `w3tr_transactions` tables and `award_w3tr` / `spend_w3tr` Postgres
 * functions in supabase/migrations/0001_schema.sql). It is NOT a cryptocurrency and
 * does not touch any blockchain, wallet, or smart contract.
 *
 * All application code should award/spend W3TR through this `RewardEngine` interface
 * rather than calling Supabase directly. The reason: if the platform later obtains
 * the licences required to represent W3TR on-chain, a new adapter (e.g.
 * `OnChainRewardEngine`) can implement this exact same interface — mirroring ledger
 * entries to a chain of choice — and be swapped in via `getRewardEngine()` below
 * WITHOUT changing a single call site anywhere else in the app.
 * =====================================================================================
 */
export interface RewardEngine {
  award(
    profileId: string,
    type: W3trTransactionType,
    amount: number,
    opts?: { referenceTable?: string; referenceId?: string; description?: string; awardedBy?: string }
  ): Promise<W3trTransaction>;

  spend(
    profileId: string,
    amount: number,
    opts?: { referenceTable?: string; referenceId?: string; description?: string }
  ): Promise<W3trTransaction>;

  getBalance(profileId: string): Promise<W3trWallet | null>;

  getTransactionHistory(profileId: string, limit?: number): Promise<W3trTransaction[]>;

  completeLesson(enrollmentId: string, lessonId: string): Promise<void>;

  recordDailyLogin(profileId: string): Promise<{ streak_day: number; w3tr_awarded: number }>;
}

/**
 * Default implementation: the off-chain ledger backed by Postgres/Supabase.
 * This is the ONLY implementation that should exist until blockchain integration
 * is licensed and approved.
 */
class LedgerRewardEngine implements RewardEngine {
  constructor(private supabase: SupabaseClient) {}

  async award(
    profileId: string,
    type: W3trTransactionType,
    amount: number,
    opts: { referenceTable?: string; referenceId?: string; description?: string; awardedBy?: string } = {}
  ): Promise<W3trTransaction> {
    const { data, error } = await this.supabase.rpc("award_w3tr", {
      p_profile_id: profileId,
      p_type: type,
      p_amount: amount,
      p_reference_table: opts.referenceTable ?? null,
      p_reference_id: opts.referenceId ?? null,
      p_description: opts.description ?? null,
      p_awarded_by: opts.awardedBy ?? null,
    });
    if (error) throw new Error(`RewardEngine.award failed: ${error.message}`);
    return data as W3trTransaction;
  }

  async spend(
    profileId: string,
    amount: number,
    opts: { referenceTable?: string; referenceId?: string; description?: string } = {}
  ): Promise<W3trTransaction> {
    const { data, error } = await this.supabase.rpc("spend_w3tr", {
      p_profile_id: profileId,
      p_amount: amount,
      p_reference_table: opts.referenceTable ?? null,
      p_reference_id: opts.referenceId ?? null,
      p_description: opts.description ?? null,
    });
    if (error) throw new Error(`RewardEngine.spend failed: ${error.message}`);
    return data as W3trTransaction;
  }

  async getBalance(profileId: string): Promise<W3trWallet | null> {
    const { data, error } = await this.supabase
      .from("w3tr_wallets")
      .select("*")
      .eq("profile_id", profileId)
      .single();
    if (error) return null;
    return data as W3trWallet;
  }

  async getTransactionHistory(profileId: string, limit = 50): Promise<W3trTransaction[]> {
    const { data, error } = await this.supabase
      .from("w3tr_transactions")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`RewardEngine.getTransactionHistory failed: ${error.message}`);
    return (data as W3trTransaction[]) ?? [];
  }

  async completeLesson(enrollmentId: string, lessonId: string): Promise<void> {
    const { error } = await this.supabase.rpc("complete_lesson", {
      p_enrollment_id: enrollmentId,
      p_lesson_id: lessonId,
    });
    if (error) throw new Error(`RewardEngine.completeLesson failed: ${error.message}`);
  }

  async recordDailyLogin(profileId: string): Promise<{ streak_day: number; w3tr_awarded: number }> {
    const { data, error } = await this.supabase.rpc("record_daily_login", { p_profile_id: profileId });
    if (error) throw new Error(`RewardEngine.recordDailyLogin failed: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    return { streak_day: row.streak_day, w3tr_awarded: Number(row.w3tr_awarded) };
  }
}

/**
 * Factory. Swap the implementation here (behind a feature flag, once blockchain
 * integration is licensed) — nothing else in the codebase needs to change.
 */
export function getRewardEngine(supabase: SupabaseClient): RewardEngine {
  return new LedgerRewardEngine(supabase);
}
