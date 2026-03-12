/**
 * Shared utility functions for TP/SL (Take Profit / Stop Loss) calculations.
 * Supports three calculation methods: price, roi (%), and earning ($).
 */

export type TpSlMethod = 'price' | 'roi' | 'earning';
export type TradeSide = 'buy' | 'sell';

/**
 * Compute the absolute price for a TP or SL target given a calculation method.
 *
 * @param val     - The user-entered value (string to match form input types)
 * @param isTp    - true = Take Profit, false = Stop Loss
 * @param method  - 'price' | 'roi' | 'earning'
 * @param price   - Entry price (string from form)
 * @param amount  - Order quantity (string from form, only used for 'earning' method)
 * @param side    - 'buy' | 'sell'
 * @returns Absolute price value, or undefined if inputs are invalid
 */
export function computeTpSlPrice(
  val: string,
  isTp: boolean,
  method: TpSlMethod,
  price: string,
  amount: string,
  side: TradeSide
): number | undefined {
  const v = parseFloat(val);
  const p = parseFloat(price);
  if (!val || isNaN(v) || isNaN(p) || p === 0 || v <= 0) return undefined;

  if (method === 'price') return v;

  if (method === 'roi') {
    const direction = side === 'buy' ? 1 : -1;
    const sign = isTp ? direction : -direction;
    return p * (1 + sign * v / 100);
  }

  if (method === 'earning') {
    const qty = parseFloat(amount);
    if (!qty || qty === 0) return undefined;
    const priceDelta = v / qty;
    const direction = side === 'buy' ? 1 : -1;
    const sign = isTp ? direction : -direction;
    return p + sign * priceDelta;
  }

  return undefined;
}
