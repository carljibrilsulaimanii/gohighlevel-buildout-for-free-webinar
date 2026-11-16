<!--
  README.md -- gohighlevel-buildout-for-free-webinar
  Author:  Jibril Sulaiman
  Date:    2026-11-16
  Lives:   Repo root (GitHub).
  What:    Click-by-click build of a whole GoHighLevel sub-account for a business that
           sells through free live classes: custom values per class, registration,
           attendance and replay workflows, payment workflows, a Stripe transactions
           custom object, membership and onboarding, sales calls, phone routing, opt-outs.
  Why:     Each piece is simple; the account only works when they're built in the right
           order and wired to the same fields, tags and custom values. This is the order
           and the wiring, taken from a production account and its defects.
-->

# GoHighLevel buildout for free webinars: from sign-up to paying member

A full GoHighLevel (GHL) sub-account build for a business that fills free live webinars
(called "free classes" in this guide),
sells a course or program after each class, and onboards buyers into a paid community. It
covers the data model, the class funnel workflows, payments, a Stripe transactions object,
membership, onboarding, sales calls, phone routing and opt-outs, in the order they depend on
each other.

Everything here comes from a production sub-account: the steps, settings, field names and
code are taken from its exported workflow definitions, and the ⚠️ traps are defects found in
it.

## Contents

- [Why it exists](#why-it-exists)
- [How it works](#how-it-works)
- [What's in this repo](#whats-in-this-repo)
- [Prerequisites and dependencies](#prerequisites-and-dependencies)
- [Setup, step by step](#setup-step-by-step)
  - Part A, foundations: [1 Folders and names](#step-1-workflow-folders-and-naming) ·
    [2 Custom fields](#step-2-custom-fields) · [3 Custom values](#step-3-custom-values-one-set-per-class-slot) ·
    [4 Pipelines](#step-4-opportunity-pipelines) · [5 Custom objects](#step-5-custom-objects) ·
    [6 Calendars](#step-6-calendars) · [7 Private integration token](#step-7-a-private-integration-token)
  - Part B, the free class: [8 Forms and pages](#step-8-forms-and-funnel-pages) ·
    [9 Attribution](#step-9-first-and-last-attribution) · [10 Registration](#step-10-free-class-registration) ·
    [11 Attended](#step-11-free-class-attended) · [12 Replay](#step-12-free-class-replay) ·
    [13 SMS lists](#step-13-sms-lists-and-campaigns) · [14 Replies](#step-14-reply-handling)
  - Part C, payments: [15 Product purchases](#step-15-product-purchase-workflows) ·
    [16 Stripe transactions object](#step-16-stripe-transactions-object) · [17 Failed payments](#step-17-failed-payments)
  - Part D, members: [18 Membership webhooks](#step-18-membership-webhooks) ·
    [19 Temperature](#step-19-member-temperature) · [20 Intake and activation](#step-20-intake-form-and-activation)
  - Part E, sales and phone: [21 Appointment confirmation](#step-21-appointment-confirmation) ·
    [22 Reminders](#step-22-appointment-reminders) · [23 IVR](#step-23-ivr-phone-menu) ·
    [24 Routing and dispositions](#step-24-inbound-routing-and-call-dispositions)
  - Part F, hygiene: [25 Opt-outs](#step-25-opt-outs-and-dnd) · [26 Sheets logging](#step-26-google-sheets-logging) ·
    [27 Final review](#step-27-final-review)
- [Running the tests](#running-the-tests)
- [Troubleshooting](#troubleshooting)
- [Limits](#limits)
- [Security](#security)
- [Related repos](#related-repos)

## Why it exists

GHL gives you forms, funnels, workflows, pipelines, calendars and payments in one place, but
no blueprint for tying them together. A class business needs every class to update dozens of
pages, emails, tags and SMS lists at once, needs reminders timed to the class rather than to
the sign-up, and needs payments and members to land on the same contact with the same fields.

What GHL doesn't do on its own, and what this build adds:

1. **One class at a time per custom value.** Custom values are account-wide. To run two
   classes in the same week you need two sets of custom values (a "slot" per class), and
   every workflow branch has to read its own slot's set.
2. **Reminders relative to the class.** Wait steps can only count back from an event if the
   run has an **Event Start Date**. The build sets it from a custom value, so "3 days before"
   follows the class date.
3. **Dates for outside systems.** Custom values are plain text ("03-04-2027 07:00 PM").
   There's no action that turns that into an ISO date with the right daylight-saving offset,
   so a Custom Code step does it ([`class-date-and-lead-source.js`](ghl-custom-code/class-date-and-lead-source.js)).
4. **No duplicate check on custom object records.** "Create record" always creates. The
   build searches the object through the GHL API first and only creates when nothing comes
   back.
5. **Stripe webhooks don't carry a GHL contact.** The build finds the contact by a Stripe
   Customer ID field, and creates the contact when it isn't there.
6. **First and last touch are on the contact, but not in fields you can report on or send
   anywhere.** Two small workflows copy GHL's attribution into custom fields.

What went wrong in production, and is called out as ⚠️ traps in the steps:

- A Custom Code step read an input that was never added, so every lead's source came out as
  the default ([Step 10e](#step-10-free-class-registration)).
- A workflow shared by two class slots used one slot's tags and SMS list for both
  ([Step 12](#step-12-free-class-replay)).
- A branch tested the wrong trigger, so one product's buyers never got their confirmation
  ([Step 15](#step-15-product-purchase-workflows)).
- A condition looked for the misspelled status "suceeded", so it never matched.
- Steps left below an "End Workflow" step never ran, including live SMS.
- Fields were mapped from date-format steps that had been deleted, so they were written blank
  on every run ([Step 16](#step-16-stripe-transactions-object)).
- API tokens were typed straight into workflow steps, where anyone with builder access can
  read them ([Security](#security)).

## How it works

```
 Ad / page / lead form ──► Registration form ──► Free Class Registration ──┬─► First / Last Attribution
                                                  (branch per class slot)  ├─► Meta / TikTok CAPI, custom audience
                                                                           ├─► tag + FC fields + CRM record (optional)
                                                                           ├─► SMS list (SlickText, optional)
                                                                           └─► confirmation, Event Start Date,
                                                                               reminders timed to the class
 Watch page "Attend" form ──► Free Class Attended ──► tag, advisor, CAPI, CRM record
 Replay page form ─────────► Free Class Replay ─────► tag, CRM record
 Text reply "hold my spot" ─► Reply handling ───────► advisor, AI bot, opportunity

 GHL order form / invoice ──► Payment Received workflows ──► product tag, confirmation email, log
 Stripe webhook ────────────► Stripe Transactions Object ──► find contact, de-duplicate, create record
 Community webhook ─────────► Membership router ──────────► plan tags, onboarding, renewals, cancellations
 Typeform intake ───────────► Intake ──► Activation check-in (Conversation AI) ──► Onboarding pipeline

 Booked call ──► Appointment confirmation ──► Enrollment Calls pipeline ──► reminders
 Inbound call ──► IVR ──► advisor / members / support      Outbound call ──► dispositions, last called
```

## What's in this repo

| Path | What it is | Where it goes |
|---|---|---|
| [`ghl-custom-code/`](ghl-custom-code/) | The three Custom Code steps, unchanged from production except placeholders | Pasted into Custom Code actions (Steps 10, 11, 12, 16, 20) |
| [`templates/`](templates/) | Custom values, custom fields and Stripe object fields to create, plus two request bodies | Used while building Steps 2, 3, 5, 10 and 16 |
| [`tests/`](tests/) | Node tests that run the Custom Code files the way GHL does | `npm test` |

## Prerequisites and dependencies

The whole build is done by hand in the GHL web app. No Claude or other AI tool is needed.

**Accounts, plans and tiers**

| What | Version or plan | Why | Check it's ready |
|---|---|---|---|
| GoHighLevel sub-account | Any plan with Workflows, Funnels, Payments and Custom Objects | Everything below | **Settings → Objects** shows **+ Add custom object** |
| GHL premium workflow actions | Enabled by your agency (billed per execution on most plans) | **Custom Code**, **Custom Webhook**, the Meta and TikTok conversion actions | The action picker shows **Custom Code** and **Custom Webhook** |
| LC Phone (GHL phone system) | Any number in **Settings → Phone System** | IVR, call status triggers, SMS | A number is listed and can send a test SMS |
| Conversation AI | Enabled in the sub-account | Reply handling and activation check-in (Steps 14, 20) | **AI Agents** lists a bot you can turn on |
| Email sending domain | LC Email or Mailgun in **Settings → Email Services** | Confirmation and reminder emails; the complaint trigger needs Mailgun | A test email arrives |
| Stripe | Connected in **Payments → Integrations**, plus Dashboard access to add webhooks | Payment triggers, Stripe webhooks (Steps 15-17) | A test order shows in **Payments → Transactions** |
| Meta Business / Events Manager | Optional | Conversion API and custom audiences in Steps 10-11 | The Meta integration shows connected in GHL |
| TikTok Ads | Optional | TikTok lead forms and the TikTok Conversion API marketplace action | The TikTok app is installed in the sub-account |
| A CRM with a REST API | Optional (HubSpot used in the original) | One record per registration, attendance and replay (Steps 10-12) | You can create a record with the API |
| SlickText | Optional | SMS lists and campaigns per class (Step 13) | See the SlickText repo's checks |
| Mighty Networks | Optional | Membership webhooks (Step 18) | See the membership router repo |
| Typeform | Optional | Intake and program forms (Step 20) | Typeform connected in GHL integrations |
| Google Workspace | Optional | Apps Script web apps that log rows to Sheets (Step 26) | A deployed web app URL ending in `/exec` |

**Permissions and scopes**

| What | Needed for | Check it's ready |
|---|---|---|
| GHL user with Admin role on the sub-account | Settings, objects, private integrations, publishing workflows | **Settings → Private Integrations** opens |
| GHL Private Integration token with custom-object record read access (scope wording may differ, e.g. "View Custom Objects") | The duplicate check in Step 16 | The search call in Step 16d returns 200 |
| CRM private app token with write access to the object you create (HubSpot: `crm.objects.custom.write` for a custom object, `crm.objects.contacts.write` for contacts) | Steps 10-12, optional | A test record appears in the CRM |
| Stripe Dashboard: Developers → Webhooks | Sending charge events to GHL | The endpoint shows recent deliveries |

**Tools with versions**

| What | Version | Why | Check it's ready |
|---|---|---|---|
| A desktop browser | Current Chrome, Edge or Firefox | The GHL builder | Builder opens and saves |
| Node.js | 20 or newer | Only to run this repo's tests | `node --version` |
| Git | any | Only to clone this repo | `git --version` |

## Setup, step by step

The build is split into six parts. Build them in order: later steps read fields, values and
pipelines made earlier.

Two conventions used throughout:

- **Class slots.** "Class A" and "Class B" are two classes that can run at the same time.
  Class A's custom values have plain names; Class B's are the same names ending in ` - 2`.
  Every workflow that serves both has one branch per slot, and each branch reads only its own
  slot's values.
- **Workflow basics.** Every workflow is made from **Automation → Workflows → Create
  workflow**, starting from scratch (wording may differ). The builder has the tabs
  **Builder**, **Settings**, **Enrollment History** and **Execution Logs**, a **Test
  Workflow** button, and a **Draft / Publish** switch at the top right. Each action panel has
  **Save Action** at the bottom. A workflow only runs after you flip it to **Publish**.

---

## Part A: Foundations

### Step 1: Workflow folders and naming

About 10 minutes.

**1a.** Open **Automation → Workflows**. Click **Create folder** and make one folder per area.
The production account used these:

| Folder | Holds |
|---|---|
| Free Class (Class A) | registration, attended, replay, data log for slot A |
| Free Class (Class B) | the same for slot B |
| UTM & Attribution Tracking | First / Last Attribution, page view events |
| Stripe | Stripe webhooks, transactions object, failed payments |
| Members | membership router, onboarding, temperature |
| Activation | activation check-in and the per-stage workflows |
| Sales | appointment confirmation and reminders, form assignment |
| Call/Text Settings | IVR, inbound routing, dispositions, call logging |
| Email Delivery | opt-outs, complaint handling |
| SMS (SlickText) | list and campaign creation |
| Assign to User | one small workflow per owner |

**1b.** Name workflows after what starts them and what they do ("Free Class Registration",
"All Stripe Transactions Object"). Give run-by-hand workflows a name that says so, because
they have no trigger.

✅ **Check:** the Workflows list shows your folders.

### Step 2: Custom fields

About 30 minutes.

**2a.** Open **Settings → Custom Fields**. The page has one tab per object (**Contact**,
**Opportunity**, **Company**, and any custom objects) and two buttons, **Create folder** and
**Create field**.

**2b.** With the **Contact** tab selected, click **Create folder** for each folder in
[`templates/custom-fields.csv`](templates/custom-fields.csv): Free Class, Attribution - First,
Attribution - Last, Stripe, Membership, Sales Calls.

**2c.** Click **Create field** for each row of [`templates/custom-fields.csv`](templates/custom-fields.csv),
using the field type in the file (**Single line**, **Date picker**, **Dropdown (single)**),
and put it in its folder. GHL builds the merge key from the name, for example
`{{contact.fc_status_tag}}`.

> ⚠️ **Date fields have no time.** GHL date fields store a day only. The build stores the
> time next to each date in a text field (`FC Reg Time` = `{{right_now.time_ampm}}`). Keep
> the pair together; reports need both.

✅ **Check:** the Contact tab's count went up by the number of rows, and each field's key
appears in the **Key** column.

### Step 3: Custom values, one set per class slot

About 30 minutes per slot.

**3a.** Open **Settings → Custom Values**. Click **Add Folder** and make **Class A** and
**Class B**.

**3b.** Click **+ Custom Value** for each row in [`templates/custom-values.csv`](templates/custom-values.csv).
Put the slot A rows in **Class A**. Then make the same set for slot B with ` - 2` at the end
of each name, in **Class B**. The page shows each value's key in the **Key** column, e.g.
`{{custom_values.class_date}}` and, for slot B, a key ending in `__2`.

| Value | Format that matters | Why |
|---|---|---|
| 7. Class Event Start Date/Time | `MM-DD-YYYY hh:mm AM/PM`, e.g. `03-04-2027 07:00 PM` | Read by the **Event Start Date** action and by the Custom Code step |
| 8. SMS Campaign #1 Date Time | `YYYY-MM-DD HH:mm:ss` | Read by the SMS scheduler |
| 9 - 9d. Tags | `<Topic> Free Class <Status> [<date>]` | The tag changes with each class, so every class is countable on its own |
| SMS List Code values | filled by a workflow, not by hand | See Step 13 |
| Dataset ID | your Meta dataset (pixel) id | Read by every Meta Conversion API action |

> ⚠️ **Change every value of a slot together.** When a class ends, update the date, time,
> event start, title and all five tags of that slot in one sitting. A slot with a new date
> and an old tag puts the new class's sign-ups under last class's tag.

✅ **Check:** **All Values** lists both sets, and searching `- 2` shows only slot B.

### Step 4: Opportunity pipelines

About 20 minutes.

**4a.** Open **Settings → Opportunities & Pipelines** and create each pipeline with its
stages, in this order:

| Pipeline | Stages |
|---|---|
| Enrollment Calls | Call Booked · Confirmed – Engaged · Confirmed – Silent · At Risk – No Response · Showed · No Show · Closed Won · Closed Lost |
| Live Event Follow-up (per advisor) | New (unworked) · Waiting for reply · In conversation · Appointment Booked · Missed Appointment · Closed Won · Closed Lost |
| Onboarding Activation | Not started – 0% · Step 1 done – 20% · Step 2 done – 40% · Step 3 done – 60% · Step 4 done – 80% · All steps done – 100% · No Response – Activation Check-In · Fully Activated |
| Level 1 – New Leads | Website contact opt-ins · Free guide downloads · Low-ticket purchases · Event ticket purchases · Social opt-ins · Free class registrants |
| Level 2 – Warm Leads | Free class attendees · Program graduates (non-member) · Event attendees (non-member) |
| Level 3 – Member Upgrades | New member · Monthly subscriber |
| Level 4 – Annual Renewals | 9 months · 6 months · 3 months · 30 days · 10 days · 3 days until renewal · Renewal successful · Renewal unsuccessful · Subscription cancelled |

✅ **Check:** **Opportunities** shows each pipeline in its pipeline picker.

### Step 5: Custom objects

About 20 minutes.

**5a.** Open **Settings → Objects** and click **+ Add custom object**. Name it **Stripe
Transactions** (plural label), with **Charge ID** as the primary display property.

**5b.** Back in **Settings → Custom Fields**, select the **Stripe Transactions** tab and click
**Create field** for each row of [`templates/stripe-transactions-object.csv`](templates/stripe-transactions-object.csv).
**Status** is a **Dropdown (single)** with the option keys `succeeded`, `failed`, `refunded`,
`paid`, which match Stripe's status values exactly.

**5c.** Add an association between **Contact** and **Stripe Transactions** (one contact, many
transactions). Name both sides "Transaction Contact" (wording may differ).

**5d. (Optional) Member Progress.** If you track course progress, make a second object
**Member Progress** (fields: Enrollment ID, Progress Percent, Progress Status, Completion
Date, Last Updated, Course ID, Course Name, Search Key, Student Name) associated to Contact.
Its full build is in the course progress repo listed under [Related repos](#related-repos).

✅ **Check:** **Settings → Objects** lists your object under **Custom objects**, and the left
menu shows it as its own page.

### Step 6: Calendars

About 15 minutes per calendar.

**6a.** Open **Settings → Calendars** and create:

| Calendar | Type | Used by |
|---|---|---|
| Enrollment advisor | Personal (one user), 30 minutes | Step 21 confirmation workflow filters on this calendar |
| Member success support | Round robin across the support team, 15 minutes | members booking help |
| One check-in calendar per support person | Personal, 15 minutes | direct links in member emails |

✅ **Check:** each calendar's booking link opens and shows slots.

### Step 7: A private integration token

About 5 minutes.

**7a.** Open **Settings → Private Integrations** and create an integration with read access
to custom object records (scope wording may differ). Copy the token once; GHL won't show it
again.

**7b.** You'll paste it into the **Authorization** of one Custom Webhook in Step 16. Note
your location id from any GHL URL (`/v2/location/<location id>/...`).

✅ **Check:** the integration is listed with the scope you picked.

---

## Part B: The free class

### Step 8: Forms and funnel pages

About 2 hours per class funnel.

**8a.** In **Sites → Forms**, build three forms per slot: a **Registration** form (name,
email, phone), an **Attend** form (email only, on the watch page), and a **Replay** form
(email, on the replay sign-up page). Name them so the slot shows: "Class A Reg Form",
"Class A Attend Form", "Class A Replay Form".

**8b.** In **Sites → Funnels**, one funnel per slot with these steps (paths are examples):

| Step | Path | Holds |
|---|---|---|
| Opt-in | `/class-register` | Registration form |
| Upsell | `/upsell` | an optional low-price kit |
| Upsell confirmation | `/upsell-confirmation` | add-to-calendar button |
| Watch page | `/watch-now` | the stream embed and the Attend form |
| Offer | `/offer` | the paid offer, shown during the class |
| Replay sign-up | `/replay-sign-up` | Replay form |
| Replay | `/replay` | the replay embed |
| Class preview | `/class-preview` | a short pre-class video |

**8c.** Put the custom values into the pages instead of typed text: the class title
`{{custom_values.class_title}}`, date, time, the stream link, the replay embed code. Changing
the custom values in Step 3 then updates every page.

✅ **Check:** preview the opt-in page and see this class's date and title.

### Step 9: First and last attribution

About 15 minutes.

**9a.** Create workflow **First - Attribution** in UTM & Attribution Tracking.

**9b.** Click **Add new trigger** → **Contact Created**. No filters.

**9c.** Add action **Update contact field** and add one row per first-touch field:

| Field (Attribution - First) | Value |
|---|---|
| Session Source - First | `{{contact.attributionSource.sessionSource}}` |
| URL - First | `{{contact.attributionSource.url}}` |
| Referrer - First | `{{contact.attributionSource.referrer}}` |
| Medium - First | `{{contact.attributionSource.medium}}` |
| Campaign - First | `{{contact.attributionSource.campaign}}` |
| Campaign Id - First | `{{contact.attributionSource.campaignId}}` |
| UTM Source - First | `{{contact.attributionSource.utmSource}}` |
| UTM Medium - First | `{{contact.attributionSource.utmMedium}}` |
| UTM Campaign - First | `{{contact.attributionSource.utmCampaign}}` |
| UTM Content - First | `{{contact.attributionSource.utmContent}}` |
| UTM Term - First | `{{contact.attributionSource.utmTerm}}` |
| UTM Keyword - First | `{{contact.attributionSource.utmKeyword}}` |
| UTM Match Type - First | `{{contact.attributionSource.utmMatchtype}}` |
| FB ClickId - First | `{{contact.attributionSource.fbclid}}` |
| Google ClickId - First | `{{contact.attributionSource.gclid}}` |
| Google Client Id - First | `{{contact.attributionSource.gaClientId}}` |
| Ad Group ID - First | `{{contact.attributionSource.adGroupId}}` |
| Ad ID - First | `{{contact.attributionSource.adId}}` |

**9d.** Save, publish. Make **Last - Attribution** the same way, with the "- Last" fields and
`contact.lastAttributionSource.*` in every value.

> ⚠️ **One merge field per box.** In production the Google ClickId box held the gclid
> followed by another click-id field twice, so the stored value was three ids glued
> together. Put exactly one merge field in each value.

> ⚠️ **"Contact Created" runs once.** With this trigger the "- Last" fields are filled when the
> contact is created and never again. To keep them current, also start Last - Attribution
> from each form workflow (Step 10c does).

✅ **Check:** create a test contact through a form with `?utm_source=test` on the URL; its
**UTM Source - First** shows `test`.

### Step 10: Free Class Registration

About 90 minutes. This is the largest workflow. Build slot A completely, test it, then add
slot B.

**10a. Create it.** Workflow **Free Class Registration**. In **Settings**, allow re-entry
(**Allow re-entry** on, wording may differ), because people register for more than one class.
Turn on **remove contact from the last step** too (wording may differ), so a finished run
doesn't block the next one.

**10b. Triggers.** Click **Add new trigger** once per source. Rename each trigger after its
source; branches test the trigger by name.

| Trigger | Filter | Rename to |
|---|---|---|
| **Form Submitted** | **Form is** Class A Reg Form | Class A Form Submitted |
| **Form Submitted** | **Form is** Class B Reg Form | Class B Form Submitted |
| **Facebook Lead Form Submitted** | **Page is** your page | Class A Facebook Lead Form |
| **TikTok Form Submitted** | none | TikTok Form Submitted |

**10c. Shared steps** (run for every trigger, in this order):

1. **Format Date** (date formatter): from **current date**, `YYYY-MM-DD` → `MMM DD, YYYY`.
2. **If/Else**, branch **Class B?**: condition **Workflow trigger** is *Class B Form
   Submitted*. In both branches add **Update contact field**:

   | Field | Class B branch | Other branch |
   |---|---|---|
   | FC Status Tag | `{{custom_values.tag__registration__2}}` | `{{custom_values.tag__registration}}` |
   | FC Reg Date | Current date | Current date |
   | FC Reg Time | `{{right_now.time_ampm}}` | `{{right_now.time_ampm}}` |

3. **If/Else** on the lead platform, with branches **Lead form** (trigger is *Class A Facebook
   Lead Form*), **TikTok** (trigger is *TikTok Form Submitted*) and **None**:
   - Lead form: **Meta Conversion API**, event type **Lead event**, dataset
     `{{custom_values.dataset_id}}`, value `1`, currency USD.
   - TikTok: **TikTok Conversion API**, event **Lead**, your pixel code.
   - None (funnel forms): **Meta Conversion API**, event type **Funnel event**, event name
     **Lead**, dataset `{{custom_values.dataset_id}}`.
   Then, for all three, **Add to customer Audience - Facebook** (your registrants audience),
   and **Add to Workflow** three times: *First - Attribution*, *Last - Attribution*, and your
   data log (Step 26).

**10d. Branch per slot.** Add **If/Else** with one branch per slot (condition **Workflow
trigger** is that slot's triggers). In each branch, in this order:

| # | Action | Settings (slot A shown; slot B uses the `__2` values) |
|---|---|---|
| 1 | **Add Tag** | `{{custom_values.tag__registration}}` |
| 2 | **Custom Code** | Step 10e |
| 3 | **Custom Webhook** (optional) | Step 10f |
| 4 | **Add to Workflow** | your SMS list workflow (Step 13) |
| 5 | **Email** | confirmation, subject e.g. "You're in, {{contact.first_name}}" |
| 6 | **Event Start Date** | Step 10g |
| 7 | **Wait** + **Email** pairs | Step 10h |
| 8 | **Remove from Workflow** → this workflow | name it "(End Workflow) Remove from Workflow" |

**10e. The Custom Code step.** Click **+**, choose **Custom Code**.

1. **Property to include in code**, one row per input:

   | Input name (left box) | Value (right box) |
   |---|---|
   | `classDateTime` | **Custom Values → 7. Class Event Start Date/Time** (slot B: the ` - 2` one). Required. |
   | `utmSource` | **Contact → Last attribution UTM source**, `{{contact.lastAttributionSource.utmSource}}`. Required for the lead source. |

2. Delete the sample code and paste in **all** of
   [`ghl-custom-code/class-date-and-lead-source.js`](ghl-custom-code/class-date-and-lead-source.js).
3. Click **Test** (wording may differ). The outputs are:

   | Output | Example | Used in |
   |---|---|---|
   | `isoDate` | `2027-03-04` | the CRM record's class date and reference |
   | `isoDateTime` | `2027-03-04T19:00:00-05:00` | any system that wants the start time |
   | `leadSourcePlatform` | `Facebook Lead Form`, `TikTok`, `Youtube`, `Google`, `Funnel/Website` | CRM record |
   | `registeredAt` | `2027-02-20T15:30:00.000Z` | CRM record |
   | `enrolledDate` | `2027-02-20` | CRM record |

> ⚠️ **Add the `utmSource` input.** In production the code read `utmSource` but only
> `classDateTime` was configured, so every record for months said "Funnel/Website". The code
> doesn't fail when an input is missing; it falls back to the default. Run `npm test` to see
> the case (the "trap" test).

**10f. (Optional) Send a record to your CRM.** **Custom Webhook**:

1. **Method** POST. **URL** your CRM's create-record endpoint (HubSpot custom object:
   `https://api.hubapi.com/crm/v3/objects/<your object type id>`).
2. **Authorization:** Bearer token, your CRM private app token. **Headers:**
   `Content-Type: application/json`.
3. **Raw body:** all of [`templates/crm-class-registration.body.json`](templates/crm-class-registration.body.json),
   with the property names changed to your CRM's. Replace `REPLACE_WITH_CLASS_SLOT_ID` with a
   fixed id per slot so the reference is unique per contact, slot and class date.
4. Fix the `custom_code.1` numbers: GHL numbers Custom Code steps in the order they were added
   in this workflow. Open the merge field picker in the body (**Custom Values** button above
   the editor) and pick **Custom Code → #N → isoDate** to get the right number.
5. Click **Test**. Success looks like *Request success with status: 201* (HubSpot) or 200.
6. If you also keep contacts in the CRM, add a sub-workflow (no trigger, started with **Add
   to Workflow**) that **Wait**s 30 seconds and upserts the contact by email (HubSpot:
   `POST /crm/v3/objects/contacts/batch/upsert` with `"idProperty": "email"`). The wait lets
   the form's fields land on the GHL contact first.

**10g. Event Start Date.** Add **Event Start Date**: **Action name** "Set Event Start Time",
**Type** *Custom Field*, **Select custom field** `{{custom_values.class_event_start_datetime}}`
(slot B: the `__2` one). The value must be in the `MM-DD-YYYY hh:mm AM/PM` format from Step 3.

**10h. Reminders timed to the class.** Add **Wait** steps that wait for the event/appointment
time (wording may differ) rather than a fixed delay, each followed by an **Email**. The
sequence one production class ran:

| Wait | Email |
|---|---|
| 1 hour after the run starts (time delay) | nurture 1 |
| 3 days before the event start | nurture 2 |
| 2 days before | nurture 3 |
| 1 day before | offer preview |
| 12 hours before | "live tonight" |
| 4 hours before | "still coming tonight?" |
| 15 minutes before | "we're starting now" |
| 10 minutes after the start | "class is in session" |

In each Wait, point it at the **Set Event Start Time** step, and choose to **skip** the wait
when the time has already passed (wording may differ), so a late registrant doesn't get
"3 days before" on class night.

**10i.** Save, publish.

> ⚠️ **Nothing below "End Workflow" runs.** The production workflow had 14 steps parked under
> its End Workflow step, six of them live SMS that had never sent. Delete leftovers, or move
> them above the end step.

> ⚠️ **Rename triggers before you branch on them.** Branch conditions show trigger names. Two
> triggers both called "Form Submitted" are impossible to tell apart in the If/Else picker.

✅ **Check:** register a test contact on slot A's page. In **Execution Logs** the run takes the
slot A branch, the contact has the slot A registration tag, FC Status Tag and FC Reg Date,
the Custom Code output shows the right `isoDate`, and the confirmation email arrives.

### Step 11: Free Class Attended

About 30 minutes.

**11a.** Workflow **Free Class Attended**, re-entry allowed. Triggers: **Form Submitted**, one
per slot's **Attend** form, renamed "Class A Attend Submitted" and "Class B Attend Submitted".

**11b.** Shared steps: **Add Tag** `attended`; **Assign to user** (your enrollment advisor,
**Only apply to unassigned contacts** off); **Meta Conversion API** (funnel event, **Lead**,
value 0); **Add to customer Audience - Facebook** (your attendees audience); **Wait** 30
seconds; **Add to Workflow** → your data log.

**11c.** **If/Else** per slot. In each branch:

| # | Action | Slot A value |
|---|---|---|
| 1 | **Update contact field** | FC Status Tag = `{{custom_values.tag__attendees}}`; FC Attend Date = Current date; FC Attend Time = `{{right_now.time_ampm}}` |
| 2 | **Add Tag** | `{{custom_values.tag__attendees}}` |
| 3 | **Custom Code** | same inputs and file as Step 10e |
| 4 | **Custom Webhook** (optional) | as Step 10f, with `class_status` "Attended", `attended` "true", `attended_at` = `registeredAt` output, and `-attended` at the end of `registration_reference` |

✅ **Check:** submit the attend form as the test contact; the attendees tag and FC Attend Date
appear, and (optional) a second CRM record with status Attended.

### Step 12: Free Class Replay

About 30 minutes. Same shape as Step 11 with the **Replay** forms, the
`tag__watched_replay` values, FC Replay Date / Time, **Recent Form Used** =
`{{contact.source}}`, and `class_status` "Watched Replay" with `-replay` on the reference.

> ⚠️ **Put every slot-specific step inside the slot branches.** In production the tag, FC
> Status Tag and SMS list steps sat above the If/Else and used slot A's values, so slot B's
> replay viewers were tagged and texted as slot A. The slot A branch also sent slot B's class
> title to the CRM. Anything that names a tag, list, title or reference belongs below the
> branch.

✅ **Check:** submit slot B's replay form; the contact gets slot B's replay tag and none of
slot A's.

### Step 13: SMS lists and campaigns

Optional, about 2 hours. Each class gets four SMS lists (registered, attended, watched replay,
did not attend) and a set of scheduled campaigns. The list ids are written back into the
slot's **SMS List Code** custom values by a workflow you run by hand before each class, and
the registration branch adds each contact to the list.

The full build (the list-creation workflow, the campaign scheduler with its Eastern-to-UTC
time conversion, and the per-contact list sync) is the SlickText repo under
[Related repos](#related-repos).

Store a link to each run-by-hand workflow in a custom value (`9f`, `9g` in
[`templates/custom-values.csv`](templates/custom-values.csv)) so the person flipping the
class finds them next to the values they just changed.

### Step 14: Reply handling

About 30 minutes.

**14a.** Workflow **Hold My Spot Response**. Two **Customer Replied** triggers on your class
texting number (**Reply channel** is SMS; **In Phone Number** your number):

| Trigger | **Contains phrase** |
|---|---|
| Customer Replied Hold Spot | `spot`, `place`, `space` |
| Customer Replied Questions | `I have a question`, `I have questions`, `Can you answer some questions` |

**14b.** **Wait** 0.1 minutes, then **If/Else** on the message body containing `hold` or
`save`. In the branch: **Add Tag** `hold my spot`, then **If/Else** by trigger:

| Branch | Steps |
|---|---|
| Hold Spot | **Assign to user** (advisor) → **Update Conversation AI Bot and Status** (your bot, Active) → **Create Or Update Opportunity** in Live Event Follow-up → *Waiting for reply* → **Wait** for the contact's reply → **Create Or Update Opportunity** → *In conversation* |
| Have Questions | the same |

✅ **Check:** text "hold my spot" from a test phone; the opportunity appears in *Waiting for
reply* and the bot answers.

---

## Part C: Payments

### Step 15: Product purchase workflows

About 20 minutes per product family.

**15a.** One workflow per product family (e.g. "Course - Payments Consolidated"). Add one
**Payment Received** trigger per product, filtered by **Global Product** is *that product*
and **Payment Status** is *succeeded*. Rename each trigger after its product.

**15b.** Steps:

1. **If/Else** on payment status succeeded (condition **Payment → Payment status** is
   `succeeded`). The **None** branch adds a tag like `course payment failed`.
2. In the succeeded branch: **Remove Tag** `course payment failed`, **Update contact field**
   (purchase date = Current date, purchase date/time text), and your data log webhook.
3. **If/Else** with one branch per trigger: **Email** (the product's confirmation) and **Add
   Tag** (the product's tag).

> ⚠️ **One trigger, one branch.** In production a "Custom Payment" branch tested the payment
> plan trigger, which the branch above it had already caught, so custom-payment buyers never
> got their confirmation. After building, open each branch and check its condition names its
> own trigger and that no trigger is left without a branch.

✅ **Check:** buy each product once in test mode (or with a 100% coupon); each buyer gets one
confirmation and one product tag.

### Step 16: Stripe transactions object

About 45 minutes. One record per Stripe charge, attached to the contact, with no duplicates.

**16a.** Workflow **All Stripe Transactions Object**. Trigger **Inbound Webhook**. Copy its URL.

**16b.** In the Stripe Dashboard, **Developers → Webhooks → Add endpoint**, paste the URL and
select the charge events you want recorded (for example `charge.succeeded`,
`charge.failed`, `charge.refunded`). Send a test event, then back in GHL load it as the trigger's sample (the trigger panel
shows the received request, wording may differ) so the `inboundWebhookRequest.data.object.*`
fields appear in pickers.

**16c.** **Find Contact** by **Stripe Customer ID** = `{{inboundWebhookRequest.data.object.customer}}`.
It has two paths:

- **Contact Not Found:** **Create Contact** with Full Name
  `{{inboundWebhookRequest.data.object.billing_details.name}}`, Email
  `{{inboundWebhookRequest.data.object.receipt_email}}`, Phone
  `{{inboundWebhookRequest.data.object.billing_details.phone}}`, Stripe Customer ID
  `{{inboundWebhookRequest.data.object.customer}}`; then **Go To** the search step below.
- **Contact Found:** continue.

**16d. Search for the charge.** **Custom Webhook**, action name "Search Transaction":

| Setting | Value |
|---|---|
| Method | POST |
| URL | `https://services.leadconnectorhq.com/objects/custom_objects.stripe_transactions/records/search` (use your object's key) |
| Authorization | Bearer token, the private integration token from Step 7 |
| Headers | `Version: 2023-02-21` |
| Raw body | all of [`templates/stripe-transaction-search.body.json`](templates/stripe-transaction-search.body.json), with your location id |
| Save response from this Webhook | ticked |

Click **Test**; *Request success with status: 200* with `"total": 0` for a new charge.

**16e.** **If/Else**, branch **Yes**: **Custom Webhook → #1 → Response → total** is greater than
`0`. Leave **Yes** empty (the record already exists). Build the next steps in **None**.

**16f. Convert the date.** **Custom Code**, action name "Convert Date":

1. **Property to include in code:**

   | Input name | Value |
   |---|---|
   | `transaction_date` | **Inbound Webhook → data.object.created** |
   | `contact_id` | **Inbound Webhook → data.object.metadata.contactId** |

2. Delete the sample code and paste in **all** of
   [`ghl-custom-code/stripe-transaction-date-and-source.js`](ghl-custom-code/stripe-transaction-date-and-source.js).
3. Outputs: `transaction_date` (`YYYY-MM-DD`, UTC) and `transaction_source` (`GHL` or
   `External`).

**16g. Create the record.** Add the custom object create action (it appears under the object's
name, wording may differ), action name "Create Associated Stripe Transaction record". Map each
field as in [`templates/stripe-transactions-object.csv`](templates/stripe-transactions-object.csv),
and turn on the association to the enrolled contact.

> ⚠️ **Merge fields point at step numbers.** `{{datetime_formatter.1.date}}` means "the first
> date formatter ever added to this workflow", even after it's deleted. In production a
> sibling workflow kept mapping two fields from deleted formatter steps, so both were written
> blank on every charge. After deleting any formatter or code step, re-pick every field that
> used it.

> ⚠️ **The charge has no fee.** `charge.*` events don't include Stripe's fee; it's on the
> balance transaction. The production build writes `0` for Stripe Fee.

✅ **Check:** resend the test event from Stripe twice. One record appears on the contact's
Stripe Transactions panel, not two.

### Step 17: Failed payments

Charge-failed and failed-invoice workflows with card-expiry formatting and reminder
sequences are a separate repo; see [Related repos](#related-repos).

> ⚠️ **Read every Wait in a sequence aloud.** In production a step named "Day 1 reminder"
> followed a 30-day Wait.

---

## Part D: Members

### Step 18: Membership webhooks

The community platform's webhooks (purchase, cancellation, join, course progress) go to one
**Inbound Webhook** workflow that routes by event type, tags the plan and renewal month,
starts onboarding, and runs a cancellation feedback sequence. That router is its own repo;
see [Related repos](#related-repos).

### Step 19: Member temperature

About 20 minutes.

**19a.** A field **MN Last Visited Network** (date) must be kept current; the last-visited sync
repo under [Related repos](#related-repos) does it with a daily script that posts to an
**Inbound Webhook** workflow: **Find Contact** by MN Member ID, then **Update contact field**
MN Last Visited Network = the posted date.

**19b.** Workflow **Member Temperature Update**. Trigger **Contact Changed**, filter **MN Last
Visited Network** has changed.

**19c.** **If/Else** on the date's age, one branch per band, each setting **Temperature**:

| Branch | Last visited | Temperature value |
|---|---|---|
| Hot | within 7 days | Hot (Active Last 7 days) |
| Warm | 8 to 30 days ago | Warm (Inactive for 8 - 30 days) |
| Cold | 31 to 60 days ago | Cold (Inactive for 31 - 60 days) |
| Ice-Cold | 61 to 90 days ago | Ice-Cold (Inactive for 61 - 90 days) |
| Frozen | 91 to 180 days ago | Frozen (Inactive for 91 days - 6 months) |
| Dormant | more than 180 days ago | Dormant (More than 6 month) |

Use the date field's "days ago" comparisons for the bands (operator wording may differ).

✅ **Check:** set a test contact's MN Last Visited Network to 45 days ago; Temperature becomes
Cold.

### Step 20: Intake form and activation

About 30 minutes for intake; activation is its own repo.

**20a.** Workflow **New Member Intake Form**. Trigger **Inbound Webhook**. In Typeform, add the
URL under **Connect → Webhooks** and send a test submission.

**20b.** In Typeform's form editor, find the field ids of the first-name and last-name
questions (in the question's settings or the webhook's sample payload under
`form_response.definition.fields`).

**20c.** **Custom Code**:

1. **Property to include in code:** `form_response` = **Inbound Webhook →
   form_response.answers**.
2. Paste in **all** of [`ghl-custom-code/typeform-intake-answers.js`](ghl-custom-code/typeform-intake-answers.js)
   and replace `REPLACE_WITH_FIRST_NAME_FIELD_ID` and `REPLACE_WITH_LAST_NAME_FIELD_ID`.
3. Outputs: `firstName`, `lastName`, `fullName`, `email`, `phone`.

**20d.** **Create Contact** with those outputs, then tag and start onboarding.

**20e.** The activation check-in (a Conversation AI step that reads a "1" to "6" reply into an
**Onboarding Activation** stage, tags it, and hands off to the next check-in) is the
activation bot repo under [Related repos](#related-repos).

> ⚠️ **Empty SMS steps still publish.** Two onboarding workflows in production went live with
> SMS actions that had no message. GHL saves and publishes them. Search each workflow for SMS
> steps and open every one before publishing.

---

## Part E: Sales and phone

### Step 21: Appointment confirmation

About 40 minutes.

**21a.** Workflow **1. Appointment Confirmation Follow-Up**. Trigger **Appointment Status**,
filters: **Event Type** normal, **Appointment status is** confirmed, **In calendar** your
enrollment advisor's calendar.

**21b.** Steps:

| # | Action | Settings |
|---|---|---|
| 1 | **Update contact field** (clear) | Booking Engagement Status |
| 2 | **Create Or Update Opportunity** | Enrollment Calls → Call Booked |
| 3 | **Create Or Update Opportunity** | Live Event Follow-up → Appointment Booked |
| 4 | **Wait** | 1 day before the appointment |
| 5 | **SMS** "Send Confirmation SMS" | "Hello {{contact.name}}, your appointment is confirmed for {{appointment.only_start_date}} at {{appointment.only_start_time}}. Are you 100% good for this scheduled time? Reply "YES" to confirm." |
| 6 | **Update contact field** | Last Booking Confirmation Sent = Current date; ... - Time = `{{right_now.time_ampm}}` |
| 7 | **Wait** for a reply to step 5, timeout 2 hours | two paths |

**21c.** Reply path: **Add Tag** `sales-confirmed-engaged`, Booking Engagement Status =
`engaged`, **Update Opportunity** → Enrollment Calls → Confirmed – Engaged. Timeout path:
**Add Tag** `sales-confirmed-silent`, status `silent`, opportunity → Confirmed – Silent.

✅ **Check:** book a test call 1 day out; the SMS arrives about 24 hours before, and replying
moves the opportunity to Confirmed – Engaged.

### Step 22: Appointment reminders

About 20 minutes. Workflow **2. Appointment Reminder Sequence**, trigger **Contact Tag**, **Tag
Added** `sales-confirmed-engaged`. **Wait** 1 day, then **If/Else** on whether the appointment
is today: send a day-of text, or a day-before text and check again the next day.

### Step 23: IVR phone menu

About 30 minutes.

**23a.** Workflow **IVR**. Trigger **Start IVR Trigger**, **In Phone Number** your numbers.

**23b.** **Gather Input on call**: play a recorded greeting (or text-to-speech), **1** digit,
timeout 5 seconds, repeat 3 times. Branches:

| Key | Branch | Then |
|---|---|---|
| 1 | Enrollment Advisor | **Connect Call** to the advisor, ring 20 seconds, record from answer → **Record Voicemail** |
| 2 | Existing Member | **Connect Call** to the member team → **Record Voicemail** |
| 3 | Customer Service | **Connect Call** to support → **Record Voicemail** |
| none | None | **Connect Call** to support → **Go To** the voicemail step |

✅ **Check:** call the number and press each key.

### Step 24: Inbound routing and call dispositions

About 40 minutes.

**24a. Incoming Channel Assign to Dept.** One **Customer Replied** trigger per channel
(**Reply channel** Instagram DM, Facebook DM, TikTok DM, SMS to a given number). **If/Else**
by trigger, each branch **Assign to user** (one person, or several split equally).

**24b. Disposition Tags.** One **Call Status** trigger per disposition, filters **Call
Direction** outbound and **Custom Disposition** contains *Not Interested* / *Mailbox Full* /
*Follow Up* / *Incorrect Number* / *Rescheduled* / *No Answer* / *Requested Appointment* /
*Voicemail*. **If/Else** by trigger; each branch sets **Disposition Result** to the same
word. *Incorrect Number* also tags `incorrect number` and turns DND on.

**24c. Update Last Called.** Trigger **Call Status**, **Call Direction** outbound. **Wait** 2
minutes, **Update contact field** Last Called By = `{{phoneCall.user.name}}`, then optional
**Assign to user** per caller.

**24d. Outgoing Call No Answer Text.** Trigger **Call Status**, **Custom Disposition** contains
*No Answer, Voicemail, Mailbox Full*. **Wait** 1 minute, then an SMS asking them to reply,
ending "Reply STOP to opt out."

✅ **Check:** make a test outbound call, pick a disposition; Disposition Result and Last Called
By fill in.

---

## Part F: Hygiene

### Step 25: Opt-outs and DND

About 20 minutes.

| Workflow | Trigger | Action |
|---|---|---|
| Email STOP DND Unsubscribe | **Contact Tag**, **Tag Added** `stop - email` | **Enable/Disable DND**: specific channel **Email**, outbound |
| Spam Complaint Email -> DND | two **Email Events** triggers (Mailgun): **Event** complained, and **Event** failed | **Enable/Disable DND**: specific channel **Email**, outbound; **Add Tag** `dnd email spam` |
| Unsubscribe from Email | **Trigger Link Clicked**, **Trigger link** your "Unsubscribe Link" (made in **Marketing → Trigger Links**, wording may differ) | **Enable/Disable DND**: specific channel **Email**, outbound |
| Stop Bot | **Contact Tag** `stop bot`, or **Customer Replied** on a number the bot mustn't answer | **Update Conversation AI Bot and Status**: inactive |

### Step 26: Google Sheets logging

Optional, about 20 minutes per sheet. Each "Google Sheets Webhook - ..." workflow has no
trigger; other workflows start it with **Add to Workflow**. It **Wait**s a few minutes (so
fields set by the caller are saved), then a **Webhook** action, method GET, URL your Apps
Script web app ending in `/exec`, with one query parameter per column (`gid` for the tab id,
contact link, date, time, the fields you want).

### Step 27: Final review

About 30 minutes, before you call the account done.

1. Open every published workflow and check nothing sits below an "(End Workflow)" step.
2. Search each workflow for SMS and Email steps with an empty body.
3. For each If/Else on **Workflow trigger**, check every trigger has exactly one branch.
4. Search conditions for misspellings of status values (`succeeded`, `failed`, `paid`). The
   production account tested `"suceeded"`, which never matches.
5. Re-pick any merge field that points at a `#N` step you deleted (Step 16 trap).
6. List every token typed into a step or a custom value ([Security](#security)).
7. Publish, then watch **Execution Logs** through one real class.

## Running the tests

```powershell
git clone https://github.com/carljibrilsulaimanii/gohighlevel-buildout-for-free-webinar
cd gohighlevel-buildout-for-free-webinar
npm test
```

Runs [`tests/custom-code.test.mjs`](tests/custom-code.test.mjs). Success ends with:

```
# tests 13
# pass 13
# fail 0
```

The tests wrap each file the way GHL runs Custom Code and cover the daylight-saving switch in
March and November, the 12 AM / 12 PM edge, unreadable dates, each lead source, the missing
`utmSource` input, the Stripe date and source, and the Typeform answers.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every CRM record says lead source "Funnel/Website" | `utmSource` input missing on the Custom Code step | [Step 10e](#step-10-free-class-registration) |
| Class time in the CRM is an hour off | `classDateTime` not in `MM-DD-YYYY hh:mm AM/PM`, or a custom value typed with a different format | [Step 3](#step-3-custom-values-one-set-per-class-slot) |
| Reminders arrive at sign-up time instead of before class | **Event Start Date** missing or reads an empty custom value; Wait not pointed at it | [Step 10g, 10h](#step-10-free-class-registration) |
| Slot B contacts get slot A's tag or SMS list | a slot-specific step sits above the slot If/Else | [Step 12](#step-12-free-class-replay) |
| A product's buyers get no confirmation | its branch tests another trigger | [Step 15](#step-15-product-purchase-workflows) |
| Two Stripe Transactions records for one charge | duplicate check missing, or Yes branch not empty | [Step 16d, 16e](#step-16-stripe-transactions-object) |
| Search webhook returns 401 | token lacks custom-object read scope, or missing `Version` header | [Step 7](#step-7-a-private-integration-token), [Step 16d](#step-16-stripe-transactions-object) |
| A field is blank on every run | mapped from a deleted step (`#N` no longer exists) | [Step 16 trap](#step-16-stripe-transactions-object) |
| "- Last" attribution never changes | Last - Attribution only runs on Contact Created | [Step 9](#step-9-first-and-last-attribution) |
| Custom Code output blank | an input name in the left box doesn't match `inputData.<name>` in the code | [Step 10e](#step-10-free-class-registration) |

## Limits

- **One class per slot.** Running three classes at once needs a third set of custom values
  and a third branch in every class workflow.
- **Custom object search counts on the query text.** The duplicate check searches by charge id;
  it relies on the charge id being unique text in the record.
- **Event-relative waits need the event start in this run.** A contact added to the workflow
  by another workflow has no Event Start Date until the Set Event Start Time step runs.
- **Premium actions cost per run** on most GHL plans (Custom Code, Custom Webhook). A busy class
  workflow runs several per registrant.
- **Stripe fee** isn't on charge events, so the object's fee field stays 0 unless you add a
  call to the balance transaction.

## Security

- **Don't type tokens into steps.** In production, a Meta Conversion API token, a TikTok token,
  CRM and SMS bearer tokens and a dialer key were typed into workflow steps and one custom
  value. Anyone who can open the builder can read them. Prefer each platform's GHL
  integration (connected once in **Settings → Integrations**) to tokens pasted into actions.
- **Treat webhook URLs as secrets.** Zapier catch hooks, Apps Script web apps and GHL inbound
  webhook URLs accept anything posted to them.
- **Rotate when people leave.** Make new tokens, update the workflows, then revoke the old
  ones. Making a new token doesn't cancel the old one.
- **Scope the private integration** to custom-object read for the Step 16 search; it needs
  nothing else.

## Related repos

| Repo | Covers |
|---|---|
| [gohighlevel-slicktext-sms-sync-and-campaign-scheduler](https://github.com/carljibrilsulaimanii/gohighlevel-slicktext-sms-sync-and-campaign-scheduler) | Step 13: SMS lists per class and scheduled campaigns |
| [stripe-gohighlevel-failed-payment-recovery](https://github.com/carljibrilsulaimanii/stripe-gohighlevel-failed-payment-recovery) | Step 17: failed charges, failed invoices, card expiry |
| [mighty-networks-webhook-router-gohighlevel](https://github.com/carljibrilsulaimanii/mighty-networks-webhook-router-gohighlevel) | Step 18: membership webhooks routed by event type |
| [mighty-networks-hubspot-last-visited-sync](https://github.com/carljibrilsulaimanii/mighty-networks-hubspot-last-visited-sync) | Step 19: the daily last-visited sync |
| [mighty-networks-course-progress-to-gohighlevel-custom-objects](https://github.com/carljibrilsulaimanii/mighty-networks-course-progress-to-gohighlevel-custom-objects) | Step 5d: the Member Progress object |
| [gohighlevel-conversation-ai-onboarding-activation-bot](https://github.com/carljibrilsulaimanii/gohighlevel-conversation-ai-onboarding-activation-bot) | Step 20e: the activation check-in bot |
| [custom-add-to-calendar-bridge](https://github.com/carljibrilsulaimanii/custom-add-to-calendar-bridge) | add-to-calendar buttons on the confirmation page |
| [hubspot-gohighlevel-contact-reengagement-report](https://github.com/carljibrilsulaimanii/hubspot-gohighlevel-contact-reengagement-report) | finding quiet contacts across GHL and HubSpot |

Built by [Jibril Sulaiman](https://github.com/carljibrilsulaimanii).
