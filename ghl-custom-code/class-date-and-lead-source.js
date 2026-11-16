// class-date-and-lead-source.js
// ---------------------------------------------------------------------------
// Author:  Jibril Sulaiman
// Date:    2026 (published 2026-11-16)
// Deploy:  GoHighLevel workflows "Free Class Registration", "Free Class Attended" and
//          "Free Class Replay Tag" > Custom Code step, one per class branch, placed right
//          before the Custom Webhook that sends the record to your CRM
//          (README Steps 10e, 11c and 12). Paste the whole file.
// What:    Turns the class's start date/time custom value into an ISO date and an ISO
//          date-time with the right US Eastern offset, stamps when the contact registered,
//          and names the platform the lead came from.
// Why:     GHL custom values are plain text ("03-04-2027 07:00 PM") and GHL has no
//          date-to-ISO action that handles daylight saving, while CRMs and reports need
//          "2027-03-04" and "2027-03-04T19:00:00-05:00". GHL conditions also can't map a
//          UTM source to a platform name in one step.
// Inputs (Property to include in code):
//   classDateTime  Custom Values > <the class slot's> Event Start Date/Time   (required)
//   utmSource      Contact > Attribution > Last attribution UTM source        (required
//                  for leadSourcePlatform; without it every lead reads "Funnel/Website")
// Outputs: isoDate, isoDateTime, leadSourcePlatform, registeredAt, enrolledDate
// ---------------------------------------------------------------------------

const raw = String(inputData.classDateTime || '').trim();
const src = String(inputData.utmSource || '').toLowerCase();

// Registration happens now.
const now = new Date();
const registeredAt = now.toISOString();          // 2026-08-16T21:41:00.000Z
const enrolledDate = registeredAt.slice(0, 10);  // 2026-08-16

let leadSourcePlatform = 'Funnel/Website';
if      (/facebook|fb|instagram|meta/.test(src)) leadSourcePlatform = 'Facebook Lead Form';
else if (/tiktok/.test(src))                     leadSourcePlatform = 'TikTok';
else if (/youtube/.test(src))                    leadSourcePlatform = 'Youtube';
else if (/google|adwords|gclid/.test(src))       leadSourcePlatform = 'Google';

let month = 0, day = 0, year = 0, hour = 19, min = '00';   // default 7:00 PM

// "08-19-2026 07:00 PM"
let m = /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw);
if (m) {
  month = +m[1]; day = +m[2]; year = +m[3]; min = m[5];
  hour = (+m[4]) % 12 + (m[6].toUpperCase() === 'PM' ? 12 : 0);
}

// "2026-08-19 19:00:00" / "2026-08-19T19:00:00"
if (!month) {
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})/.exec(raw);
  if (m) { year = +m[1]; month = +m[2]; day = +m[3]; hour = +m[4]; min = m[5]; }
}

// "Aug 19th, 2026"
if (!month) {
  m = /^([A-Za-z]{3,})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(raw);
  if (m) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    month = months.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    day = +m[2]; year = +m[3];
  }
}

if (!month || !day || !year) {
  return { isoDate: '', isoDateTime: '', leadSourcePlatform, registeredAt, enrolledDate };
}

// US Eastern DST: 2nd Sunday of March 02:00 → 1st Sunday of November 02:00
const nthSunday = (y, monthIdx, n) => {
  const first = (7 - new Date(Date.UTC(y, monthIdx, 1)).getUTCDay()) % 7 + 1;
  return first + (n - 1) * 7;
};
const dstStart = nthSunday(year, 2, 2);
const dstEnd   = nthSunday(year, 10, 1);

const afterStart = month > 3  || (month === 3  && day > dstStart) || (month === 3  && day === dstStart && hour >= 2);
const beforeEnd  = month < 11 || (month === 11 && day < dstEnd)   || (month === 11 && day === dstEnd   && hour < 2);
const offset = (afterStart && beforeEnd) ? '-04:00' : '-05:00';

const p = (n) => String(n).padStart(2, '0');
const isoDate = `${year}-${p(month)}-${p(day)}`;

return {
  isoDate,
  isoDateTime: `${isoDate}T${p(hour)}:${min}:00${offset}`,
  leadSourcePlatform,
  registeredAt,
  enrolledDate
};
