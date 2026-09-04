# Making the site readable by Meta, Google and the rest

The site does not hand anyone a file. Nothing crawls it for conversions. It
**announces what happened** to `dataLayer`, and a tag manager decides who hears
it. That is the "third entity" in the middle.

```
site  ──►  dataLayer  ──►  Google Tag Manager  ──►  GA4
                                                ├─► Google Ads
                                                ├─► Meta pixel
                                                └─► anything added later
```

Set `ANALYTICS.GTM_ID` in `main.js` and a marketer can add or change every tag
inside GTM without a code change or a deploy. That is the whole point: the site
stops being in the loop.

## What the site announces

| Event | When | Payload |
| --- | --- | --- |
| `virtual_page_view` | a screen opens — `#calendar`, `#register`, `#volunteer` | `page_path`, `page_title` |
| `registration_complete` | the bridge **confirms** a new row | `form`, `campaign_ref`, `submission_id` |

`registration_complete` never fires on a click, on a duplicate, or in demo mode.
A conversion always means a real row in the sheet.

**No personal data is ever sent.** No name, email or phone reaches Google or
Meta from this site. `submission_id` is an opaque random id — its second use is
as Meta's `eventID`, which deduplicates this browser event against a
server-side copy if the Conversions API is added later.

`campaign_ref` comes from `?ref=` or `utm_source`, so every conversion is
attributable to the link it came from.

## Without GTM

Fill in `GA4_ID`, `META_PIXEL_ID`, `GOOGLE_ADS_ID` (plus per-form conversion
labels) and the site loads those directly. Nothing loads for an id left blank —
with none set, the site ships with no trackers at all.

## Where the raw material lives

- **GA4** — free, and the store as well as the reporting. Events, funnels,
  audiences, and audiences pushed on to Google Ads.
- **GA4 → BigQuery** — free tier. Event-level rows, queryable in SQL, if
  someone wants the raw grain rather than GA4's reports.
- **Looker Studio** — free dashboards, and it reads the Master sheet directly,
  so registrations and ad performance can sit side by side.

Meta cannot read GA4. It gets its own events through the pixel, and if
person-level matching is ever wanted, through the Conversions API — which sends
**hashed** email and phone, and needs the consent wording changed first, since
people currently consent only to being contacted by Param Foundation.

## Before switching any of this on

The consent checkbox links to `#`. A privacy policy naming the analytics in use
should exist first, and under the DPDP Act a cookie/consent notice is the
safer read for tracking scripts.
