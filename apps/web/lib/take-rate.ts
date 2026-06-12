import { isPlatformFeeExempt } from "./platform-fee";

const DEFAULT_TAKE_RATE_BPS = 1000; // 10.00%

type ProgramTakeRateInput = { platformFeePaid: boolean };
type CreatorTakeRateInput = {
  platformPaymentComplete: boolean;
  platformPromoGranted: boolean;
  email: string | null;
};

export function getTakeRateBps(opts: {
  program: ProgramTakeRateInput;
  creator: CreatorTakeRateInput;
}): number {
  if (opts.program.platformFeePaid) return 0;
  if (opts.creator.platformPaymentComplete || opts.creator.platformPromoGranted) return 0;
  if (isPlatformFeeExempt(opts.creator.email)) return 0;
  return DEFAULT_TAKE_RATE_BPS;
}

export function computeApplicationFeeCents(amountCents: number, bps: number): number {
  if (bps <= 0 || amountCents <= 0) return 0;
  return Math.round((amountCents * bps) / 10_000);
}

export function isGrandfathered(opts: {
  program: ProgramTakeRateInput;
  creator: CreatorTakeRateInput;
}): boolean {
  return getTakeRateBps(opts) === 0;
}

export { DEFAULT_TAKE_RATE_BPS };
