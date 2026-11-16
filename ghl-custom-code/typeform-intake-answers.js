// typeform-intake-answers.js
// ---------------------------------------------------------------------------
// Author:  Jibril Sulaiman
// Date:    2026 (published 2026-11-16)
// Deploy:  GoHighLevel workflow "New Member Intake Form" > Custom Code step, the first
//          step after the Inbound Webhook trigger (README Step 20c). Paste the whole
//          file, then replace the two REPLACE_WITH_ field ids with your form's.
// What:    Pulls first name, last name, email and phone out of a Typeform webhook's
//          answers array so the next step can create or update the contact.
// Why:     Typeform sends answers as an array in question order, not as named fields.
//          Email and phone are found by answer type; the two name questions are both
//          type "text", so they are found by their Typeform field id.
// Inputs (Property to include in code):
//   form_response  Inbound Webhook > form_response.answers
// Outputs: firstName, lastName, fullName, email, phone
// ---------------------------------------------------------------------------

const raw = inputData.form_response;
const answers = typeof raw === "string" ? JSON.parse(raw) : raw;

const firstName = answers.find(a => a.type === "text" && a.field.id === "REPLACE_WITH_FIRST_NAME_FIELD_ID")?.text || null;
const lastName = answers.find(a => a.type === "text" && a.field.id === "REPLACE_WITH_LAST_NAME_FIELD_ID")?.text || null;
const email = answers.find(a => a.type === "email")?.email || null;
const phone = answers.find(a => a.type === "phone_number")?.phoneNumber || null;

return {
  firstName,
  lastName,
  fullName: firstName && lastName ? `${firstName} ${lastName}` : null,
  email,
  phone
};
