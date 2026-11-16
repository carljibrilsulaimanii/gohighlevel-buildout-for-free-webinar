// stripe-transaction-date-and-source.js
// ---------------------------------------------------------------------------
// Author:  Jibril Sulaiman
// Date:    2026 (published 2026-11-16)
// Deploy:  GoHighLevel workflow "All Stripe Transactions Object" > Custom Code step
//          "Convert Date", on the "None" branch after the duplicate check
//          (README Step 16f). Paste the whole file.
// What:    Turns the Stripe charge's Unix "created" time into YYYY-MM-DD (UTC), and
//          labels the charge "GHL" when it carries a GHL contactId in its metadata
//          (charged through a GHL order form or invoice) or "External" when it doesn't
//          (charged in Stripe directly, or by another tool).
// Why:     Stripe sends seconds since 1970; GHL fields need a date. The metadata check
//          tells you which Stripe charges GHL itself created.
// Inputs (Property to include in code):
//   transaction_date  Inbound Webhook > data.object.created
//   contact_id        Inbound Webhook > data.object.metadata.contactId
// Outputs: transaction_date, transaction_source
// ---------------------------------------------------------------------------

const unixTimestamp = inputData.transaction_date;
const date = new Date(unixTimestamp * 1000);
const yyyy = date.getUTCFullYear();
const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
const dd = String(date.getUTCDate()).padStart(2, '0');

const contactId = inputData.contact_id;
const transactionSource = (contactId && contactId !== "null" && contactId !== "") ? "GHL" : "External";

return {
  transaction_date: `${yyyy}-${mm}-${dd}`,
  transaction_source: transactionSource
};
