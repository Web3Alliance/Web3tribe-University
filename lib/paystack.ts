const PAYSTACK_BASE_URL = "https://api.paystack.co";

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: { authorization_url: string; access_code: string; reference: string };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: { status: string; reference: string; amount: number; currency: string; paid_at: string | null };
}

/**
 * Initializes a Paystack transaction. Requires PAYSTACK_SECRET_KEY to be set;
 * throws a clear error otherwise rather than silently failing.
 */
export async function initializePaystackTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitializeResponse["data"]> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not configured. Add it to your environment variables to accept card/bank donations."
    );
  }

  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  const json = (await res.json()) as PaystackInitializeResponse;
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Failed to initialize Paystack transaction.");
  }
  return json.data;
}

export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResponse["data"]> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) throw new Error("PAYSTACK_SECRET_KEY is not configured.");

  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  const json = (await res.json()) as PaystackVerifyResponse;
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Failed to verify Paystack transaction.");
  }
  return json.data;
}

/**
 * Validates a Paystack webhook signature per their documented HMAC SHA512 scheme.
 * See: https://paystack.com/docs/payments/webhooks/
 */
export async function verifyPaystackWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return false;

  const crypto = await import("node:crypto");
  const hash = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  return hash === signatureHeader;
}
