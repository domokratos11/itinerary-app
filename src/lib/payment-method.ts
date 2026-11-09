import { PAYMENT_METHODS, type PaymentMethod } from "@/domain/schemas";

// The card or cash last chosen on this device, offered first next time.
// Only a convenience: without storage every new expense starts on card.
export const PAYMENT_METHOD_KEY = "payment-method";

export function lastPaymentMethod(): PaymentMethod {
  try {
    const saved = localStorage.getItem(PAYMENT_METHOD_KEY);
    return PAYMENT_METHODS.find((m) => m === saved) ?? "card";
  } catch {
    return "card";
  }
}

export function rememberPaymentMethod(method: PaymentMethod): void {
  try {
    localStorage.setItem(PAYMENT_METHOD_KEY, method);
  } catch {
    // Only a convenience for next time.
  }
}
