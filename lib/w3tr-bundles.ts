export interface W3trBundle {
  key: "starter" | "popular" | "best_value";
  label: string;
  w3trAmount: number;
  amountNaira: number;
  badge?: string;
}

/**
 * Priced so that buying W3TR never trivializes earning it: a student who
 * genuinely completes a typical course (10 lessons + their quizzes, a final
 * exam, and the completion bonus) earns about 60 W3TR through real effort.
 * Buying that same 60 W3TR outright costs a few thousand naira — a real,
 * meaningful amount — not something that makes learning pointless by
 * comparison. Bundle discounts reward committing to a bigger top-up.
 */
export const W3TR_BUNDLES: W3trBundle[] = [
  { key: "starter", label: "Starter", w3trAmount: 50, amountNaira: 2500 },
  { key: "popular", label: "Popular", w3trAmount: 150, amountNaira: 6000, badge: "Save 20%" },
  { key: "best_value", label: "Best Value", w3trAmount: 500, amountNaira: 18000, badge: "Save 28%" },
];

export function findBundle(key: string): W3trBundle | undefined {
  return W3TR_BUNDLES.find((b) => b.key === key);
}

/**
 * Required disclaimer, surfaced everywhere W3TR purchases happen (the buy
 * page, the wallet page, and the Terms of Service): W3TR is an in-app token
 * economy, not a security, cryptocurrency, or tradable asset. If it's ever
 * made tradable/transferable or deployed on a blockchain in the future, all
 * necessary compliance certification/requirements must be met first.
 */
export const W3TR_DISCLAIMER =
  "W3TR is an in-app token economy, useful only on the Web3tribe University platform for now. " +
  "It is not a security, cryptocurrency, or tradable asset, and cannot be exchanged, transferred, " +
  "or redeemed for cash outside the platform. If Web3.0 Alliance Ltd decides in the future to make " +
  "W3TR tradable or transferable, or to deploy it on a blockchain, all necessary compliance " +
  "certifications and regulatory requirements will be met first.";