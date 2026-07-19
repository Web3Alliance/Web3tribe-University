/** Once this many students have gone through the biodata gate (whether by
 * filling it in or skipping), the skip option disappears permanently and
 * every student after that must actually complete the form. Temporary
 * allowance for testing/showcase purposes only. */
export const BIODATA_SKIP_LIMIT = 30;

export interface BiodataFormState {
  error: string | null;
  success?: boolean;
}

export interface BiodataGateStatus {
  /** True if this student has already gone through the gate (filled or skipped) — enrollment is allowed. */
  hasCleared: boolean;
  /** True if the skip button should still be shown (fewer than BIODATA_SKIP_LIMIT students have gone through so far). */
  skipAllowed: boolean;
  totalThroughGate: number;
}