export const PRO_FOUNDER_OFFER_CODE = "PRO_ANNUAL_FOUNDER" as const;
export const PRO_FOUNDER_OFFER_NAME = "founder" as const;
export const PRO_FOUNDER_PRICE_AMOUNT_PEN = 299 as const;
export const PRO_STANDARD_PRICE_AMOUNT_PEN = 349 as const;
export const PRO_FOUNDER_PRICE_DISPLAY = "S/ 299/año" as const;
export const PRO_STANDARD_PRICE_DISPLAY = "S/ 349/año" as const;
export const PRO_FOUNDER_YAPE_AMOUNT = "S/ 299.00" as const;

export const PRO_FOUNDER_STRIPE_METADATA = {
  offer: PRO_FOUNDER_OFFER_NAME,
  plan: "pro",
  price_amount: String(PRO_FOUNDER_PRICE_AMOUNT_PEN),
} as const;

export const PRO_STANDARD_STRIPE_METADATA = {
  offer: "standard",
  plan: "pro",
  price_amount: String(PRO_STANDARD_PRICE_AMOUNT_PEN),
} as const;
