/**
 * custom-code.test.mjs -- runs the three GHL Custom Code steps in Node
 * --------------------------------------------------------------------
 * Author:  Jibril Sulaiman
 * Created: 2026-11-16 (ET)
 * Deploy:  Local only. Run with `npm test` (Node 20+).
 * What:    Wraps each file the way GoHighLevel does (an async function with
 *          inputData; `return` gives the result) and checks the class date
 *          conversion across daylight saving, the lead source names, the missing
 *          utmSource trap, the Stripe date and source, and the Typeform answers.
 * Why:     GHL's "Test" button runs the code once against sample values. A class that
 *          falls the week after the clocks change, or a branch that never matches,
 *          only shows up later as wrong data in your CRM.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (f) => readFileSync(new URL(`../ghl-custom-code/${f}`, import.meta.url), 'utf8');

// Freeze "now" so registeredAt / enrolledDate are predictable.
const FIXED_NOW = Date.parse('2027-02-20T15:30:00.000Z');
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...a) { super(...(a.length ? a : [FIXED_NOW])); }
  static now() { return FIXED_NOW; }
}

async function runGhl(file, inputData) {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const fn = new AsyncFunction('inputData', 'Date',
    `let output; const __r = await (async () => { ${load(file)} })(); return __r !== undefined ? __r : output;`);
  return JSON.parse(JSON.stringify(await fn(inputData, FrozenDate)));
}

// ---------- class-date-and-lead-source.js ----------

test('class date: "MM-DD-YYYY hh:mm PM" in winter gets the -05:00 offset', async () => {
  const out = await runGhl('class-date-and-lead-source.js', { classDateTime: '03-04-2027 07:00 PM' });
  assert.equal(out.isoDate, '2027-03-04');
  assert.equal(out.isoDateTime, '2027-03-04T19:00:00-05:00');
});

test('class date: the week after clocks go forward gets -04:00', async () => {
  // 2027 DST starts Sunday March 14.
  const before = await runGhl('class-date-and-lead-source.js', { classDateTime: '03-13-2027 07:00 PM' });
  const after = await runGhl('class-date-and-lead-source.js', { classDateTime: '03-14-2027 07:00 PM' });
  assert.equal(before.isoDateTime, '2027-03-13T19:00:00-05:00');
  assert.equal(after.isoDateTime, '2027-03-14T19:00:00-04:00');
});

test('class date: the first Sunday of November switches back to -05:00', async () => {
  // 2027 DST ends Sunday November 7.
  const sat = await runGhl('class-date-and-lead-source.js', { classDateTime: '11-06-2027 07:00 PM' });
  const sun = await runGhl('class-date-and-lead-source.js', { classDateTime: '11-07-2027 07:00 PM' });
  assert.equal(sat.isoDateTime, '2027-11-06T19:00:00-04:00');
  assert.equal(sun.isoDateTime, '2027-11-07T19:00:00-05:00');
});

test('class date: also reads "YYYY-MM-DD HH:mm:ss" and "Mon DDth, YYYY" (default 7 PM)', async () => {
  const a = await runGhl('class-date-and-lead-source.js', { classDateTime: '2027-06-10 20:30:00' });
  assert.equal(a.isoDateTime, '2027-06-10T20:30:00-04:00');
  const b = await runGhl('class-date-and-lead-source.js', { classDateTime: 'Jan 21st, 2027' });
  assert.equal(b.isoDateTime, '2027-01-21T19:00:00-05:00');
});

test('class date: 12 AM and 12 PM convert correctly', async () => {
  const noon = await runGhl('class-date-and-lead-source.js', { classDateTime: '01-05-2027 12:00 PM' });
  const midnight = await runGhl('class-date-and-lead-source.js', { classDateTime: '01-05-2027 12:15 AM' });
  assert.equal(noon.isoDateTime, '2027-01-05T12:00:00-05:00');
  assert.equal(midnight.isoDateTime, '2027-01-05T00:15:00-05:00');
});

test('class date: an unreadable value returns blanks instead of a wrong date', async () => {
  const out = await runGhl('class-date-and-lead-source.js', { classDateTime: 'next Tuesday' });
  assert.equal(out.isoDate, '');
  assert.equal(out.isoDateTime, '');
});

test('registeredAt and enrolledDate come from the run time', async () => {
  const out = await runGhl('class-date-and-lead-source.js', { classDateTime: '03-04-2027 07:00 PM' });
  assert.equal(out.registeredAt, '2027-02-20T15:30:00.000Z');
  assert.equal(out.enrolledDate, '2027-02-20');
});

test('lead source: each UTM source maps to a platform name', async () => {
  const cases = { facebook: 'Facebook Lead Form', ig: 'Funnel/Website', instagram: 'Facebook Lead Form',
    tiktok: 'TikTok', youtube: 'Youtube', google: 'Google', newsletter: 'Funnel/Website' };
  for (const [utmSource, expected] of Object.entries(cases)) {
    const out = await runGhl('class-date-and-lead-source.js', { classDateTime: '03-04-2027 07:00 PM', utmSource });
    assert.equal(out.leadSourcePlatform, expected, `utmSource=${utmSource}`);
  }
});

test('trap: without the utmSource input every lead reads "Funnel/Website"', async () => {
  const out = await runGhl('class-date-and-lead-source.js', { classDateTime: '03-04-2027 07:00 PM' });
  assert.equal(out.leadSourcePlatform, 'Funnel/Website');
});

// ---------- stripe-transaction-date-and-source.js ----------

test('stripe: Unix seconds become the UTC date', async () => {
  // 2027-02-21T03:10:00Z is still Feb 20 in New York; the field stores the UTC date.
  const out = await runGhl('stripe-transaction-date-and-source.js', { transaction_date: 1803179400, contact_id: '' });
  assert.equal(out.transaction_date, '2027-02-21');
});

test('stripe: a GHL contactId in metadata means the charge came from GHL', async () => {
  const ghl = await runGhl('stripe-transaction-date-and-source.js', { transaction_date: 1803179400, contact_id: 'abc123' });
  const ext = await runGhl('stripe-transaction-date-and-source.js', { transaction_date: 1803179400, contact_id: 'null' });
  assert.equal(ghl.transaction_source, 'GHL');
  assert.equal(ext.transaction_source, 'External');
});

// ---------- typeform-intake-answers.js ----------

const answers = [
  { type: 'text', text: 'Pat', field: { id: 'REPLACE_WITH_FIRST_NAME_FIELD_ID' } },
  { type: 'text', text: 'Example', field: { id: 'REPLACE_WITH_LAST_NAME_FIELD_ID' } },
  { type: 'text', text: 'Some other answer', field: { id: 'other' } },
  { type: 'email', email: 'pat@example.com', field: { id: 'e' } },
  { type: 'phone_number', phoneNumber: '+15555550123', field: { id: 'p' } },
];

test('typeform: pulls the contact out of the answers array (string or object)', async () => {
  const expected = { firstName: 'Pat', lastName: 'Example', fullName: 'Pat Example',
    email: 'pat@example.com', phone: '+15555550123' };
  assert.deepEqual(await runGhl('typeform-intake-answers.js', { form_response: answers }), expected);
  assert.deepEqual(await runGhl('typeform-intake-answers.js', { form_response: JSON.stringify(answers) }), expected);
});

test('typeform: missing answers come back as null, not undefined', async () => {
  const out = await runGhl('typeform-intake-answers.js', { form_response: [answers[3]] });
  assert.deepEqual(out, { firstName: null, lastName: null, fullName: null, email: 'pat@example.com', phone: null });
});
