# For the performance marketer

Everything below is already sending. Nothing more is needed from the Foundation,
and nothing here collects personal data — no names, emails or phone numbers ever
reach Google or Meta.

## What the site already reports

The site is one page with screens that open over it, so views are reported by
hand. Every event below is pushed to `dataLayer`, ready for a GTM trigger.

| Event | Fires when | Carries |
| --- | --- | --- |
| `virtual_page_view` | The home page loads, or someone opens the calendar, register or volunteer screen | `page_path` (`/`, `#calendar`, `#register`, `#volunteer`), `page_title` |
| `cta_click` | Any button or link to register, volunteer or the calendar is tapped | `destination`, `label` (the words on the button), `programme` (the event name, from a calendar row), `from` (the screen it happened on), `campaign_ref` |
| `call_click` | The phone number is tapped | `label`, `number`, `from`, `campaign_ref` |
| `email_click` | An email address is tapped | `label`, `from`, `campaign_ref` |
| `outbound_click` | A link off the site is tapped, e.g. a venue on Google Maps | `host`, `label`, `from`, `campaign_ref` |
| `registration_complete` | **A row is confirmed saved.** Never on click, never on a duplicate, never in demo mode | `form` (`updates` or `volunteer`), `campaign_ref`, `submission_id` |

`campaign_ref` is on every event, so any of them can be split by where the link
was shared. `submission_id` is an opaque key, useful for deduplicating against a
server-side copy.

## Links

Staff mint links at `/admin/campaign-links.html`. They answer two questions —
where the link should open, and where it will be used — and the tool writes the
rest: `utm_source`, `utm_medium`, `utm_campaign` (the month unless named),
`utm_content` and a `ref` tag. QR codes are generated for posters. Every minted
link is recorded in the `Mint` tab of the registration sheet.

## What is left to do, inside GTM

The container `GTM-5S6DXF7V` is installed on every page. It needs tags:

1. **GA4 configuration tag** on All Pages, with the measurement ID.
2. **GA4 event tag** for each event above, using a Custom Event trigger with the
   same name. Map the fields as event parameters.
3. Mark `registration_complete` as the conversion. Two of them if you want them
   separated: `form = volunteer` and `form = updates`.
4. Register the parameters as custom dimensions in GA4, or they will not show in
   reports: `destination`, `label`, `programme`, `from`, `campaign_ref`, `form`,
   `host`.

Ads and Meta can be added in the container without touching the site. If you
prefer them wired directly, `main.js` has an `ANALYTICS` block at the top that
takes GA4, Google Ads and Meta pixel ids.

## Please do not

- Send personal data into any tag. The events deliberately carry none.
- Fire a conversion on a button click. `registration_complete` already means a
  confirmed row, which is the honest number.
