// Validation + helpers for a tutor's payout (bank / UPI) details.

const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9]{2,64}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;

const clean = (value) => (value === undefined || value === null ? '' : String(value).trim());

// true if the body contains any payout field at all (used by updateCourse to
// know whether the tutor is changing their payout details)
export const hasPayoutFields = (body) =>
  ['payoutMethod', 'accountHolderName', 'upiId', 'bankAccountNumber', 'ifscCode', 'bankName']
    .some((key) => body[key] !== undefined);

// reads the flat payout fields from req.body and returns either
// { details } (clean, ready to save) or { error } (message for the tutor)
export const parsePayoutDetails = (body) => {
  const method = clean(body.payoutMethod).toLowerCase();
  const accountHolderName = clean(body.accountHolderName);

  if (method !== 'upi' && method !== 'bank') {
    return { error: "Choose how you want to be paid: 'upi' or 'bank'" };
  }
  if (accountHolderName.length < 2 || accountHolderName.length > 80) {
    return { error: "Account holder name must be between 2 and 80 characters" };
  }

  if (method === 'upi') {
    const upiId = clean(body.upiId);
    if (!UPI_REGEX.test(upiId)) {
      return { error: "Enter a valid UPI ID, for example name@okaxis" };
    }
    return { details: { method, accountHolderName, upiId } };
  }

  const bankAccountNumber = clean(body.bankAccountNumber).replace(/\s+/g, '');
  const ifscCode = clean(body.ifscCode).toUpperCase();
  const bankName = clean(body.bankName);

  if (!ACCOUNT_NUMBER_REGEX.test(bankAccountNumber)) {
    return { error: "Bank account number must be 9 to 18 digits" };
  }
  if (!IFSC_REGEX.test(ifscCode)) {
    return { error: "Enter a valid IFSC code, for example SBIN0001234" };
  }
  if (bankName.length > 80) {
    return { error: "Bank name is too long" };
  }
  return { details: { method, accountHolderName, bankAccountNumber, ifscCode, bankName } };
};

// share of a payment that goes to the tutor. PLATFORM_FEE_PERCENT is the cut
// you keep (0 means the tutor gets everything). Set it in your environment.
export const tutorShareOf = (amount) => {
  const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || 0);
  const safeFee = Number.isFinite(feePercent) ? Math.min(Math.max(feePercent, 0), 100) : 0;
  return Math.round(amount * (100 - safeFee)) / 100;
};

// ---------- payout rules ----------
// A payment is only paid out to the tutor after a holding period, so money that
// might still be refunded isn't sent out. Both values can be changed with
// environment variables on Render:
//   PAYOUT_HOLD_DAYS     (default 30)
//   MIN_PAYOUT_AMOUNT    (default 500, in rupees)

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export const payoutHoldDays = () => numberFromEnv('PAYOUT_HOLD_DAYS', 30);
export const minPayoutAmount = () => numberFromEnv('MIN_PAYOUT_AMOUNT', 500);

const DAY_MS = 24 * 60 * 60 * 1000;

// the date from which a payment made at `paymentDate` can be paid out
export const payoutEligibleOn = (paymentDate) =>
  new Date(new Date(paymentDate).getTime() + payoutHoldDays() * DAY_MS);

export const isPayoutEligible = (paymentDate, now = new Date()) =>
  payoutEligibleOn(paymentDate).getTime() <= now.getTime();
