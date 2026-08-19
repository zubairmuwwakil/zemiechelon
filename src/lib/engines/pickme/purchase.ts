import { Network } from "./catalogue";

export interface PurchaseContext {
  amountCad: number;
  currency: string;
  usdEquivalent?: number;
  category: string;
  mcc?: number;
  merchantBrand?: string;
  country: string;
  channel: string;
  recurringIndicator: boolean;
  acceptedNetworks: Set<Network>;
}

export function makePurchase(
  p: Partial<PurchaseContext> & Pick<PurchaseContext, "amountCad" | "category">,
): PurchaseContext {
  return {
    currency: "CAD",
    country: "CA",
    channel: "cardPresent",
    recurringIndicator: false,
    acceptedNetworks: new Set<Network>(["amex", "visa", "mastercard"]),
    ...p,
  };
}
