export interface QuoteItemMessage {
  menuItemId: string;
  quantity: number;
}

export interface QuoteRequestMessage {
  restaurantId: string;
  items: QuoteItemMessage[];
  traceparent?: string;
}

export interface QuoteLineMessage {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface QuoteResponseMessage {
  restaurantId: string;
  lines: QuoteLineMessage[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  currency: string;
  error?: string;
}

export interface PricingServiceClient {
  calculateQuote(request: QuoteRequestMessage): import('rxjs').Observable<QuoteResponseMessage>;
}
