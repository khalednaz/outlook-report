1) How the logic works with our GoPhish app
High-level flow

User opens an email in Outlook.

User clicks “Report Phishing” (your Office.js command).

The add-in extracts a /report?rid=... URL from the email body (without hardcoding the domain).

The add-in calls your GoPhish server endpoint:

GET https://<YOUR_BASE>/report?rid=<RID>

GoPhish resolves the RID, loads the correct Result, and marks it as Reported.

Outlook add-in: resolve report URL (no hardcoded domain)

In your add-in (outlook-addin/commands.js), the URL is resolved like this:

function resolveReportUrl_(combinedBody) {
  // (1) Marker: BRIXEON_REPORT_URL:... or BRIXEON_REPORT_URL=...
  var marker = extractMarkerUrlAny_(combined, "BRIXEON_REPORT_URL");
  if (marker) return normalizeReportUrl_(marker);

  // (2) Any URL containing /report?rid=
  var reportLink = findFirstUrlContaining_(combined, "/report?rid=");
  if (reportLink) return normalizeReportUrl_(extractDirectUrl_(reportLink));

  // (3) Fallback: extract rid + base from any rid link, then build /report
  var rid = extractRidFromText_(combined);
  var ridLink = findFirstUrlContainingRid_(combined);
  var base = getBaseUrl_(extractDirectUrl_(ridLink));
  return base.replace(/\/+$/, "") + "/report?rid=" + encodeURIComponent(rid);
}


Then it hits the endpoint:

function hitReportEndpoint_(url, cb) {
  fetch(url, { method: "GET", redirect: "follow", credentials: "omit" })
    .then(function (resp) {
      var ok = (resp.status === 204 || resp.status === 200 || resp.status === 302);
      cb({ ok: ok, code: resp.status });
    })
    .catch(function (err) { cb({ ok: false, code: 0, err: String(err) }); });
}

GoPhish server: how /report?rid=... is processed

Your GoPhish fork handles this in controllers/phish.go.

RID extraction (query param) happens in setupContext():

func setupContext(r *http.Request) (*http.Request, error) {
  err := r.ParseForm()
  rid := r.Form.Get(models.RecipientParameter)
  if rid == "" { return r, ErrInvalidRequest }

  r = ctx.Set(r, "rid", rid)
  r = ctx.Set(r, "result", rs)
  r = ctx.Set(r, "campaign", c)
  r = ctx.Set(r, "details", d)
  return r, nil
}


Then the report handler calls the Result logic:

func (ps *PhishingServer) ReportHandler(w http.ResponseWriter, r *http.Request) {
  r, err := setupContext(r)
  rid := ctx.Get(r, "rid").(string)
  d := ctx.Get(r, "details").(models.EventDetails)

  err = rs.HandleEmailReport(d)
  w.WriteHeader(http.StatusNoContent)
}


And the Result is marked as Reported in models/result.go:

func (r *Result) HandleEmailReport(details EventDetails) error {
  event, err := r.createEvent(EventReported, details)
  r.Reported = true
  r.ModifiedDate = event.Time
  return db.Save(r).Error
}


✅ End result: campaign results show the user reported the simulation.

2) How a user reports the email (usage)
User steps (Outlook)

Open the suspicious email inside Outlook (Web/Desktop).

Click the Brixeon add-in button (e.g., “Report Phishing”).

The add-in:

reads the message body,

finds the report link,

calls your GoPhish /report?rid=... endpoint,

shows a success/fail notification.

What the user sees

Success: “Reported successfully” (or your chosen message)

Failure: “Couldn’t find a report link…” (usually means the template is missing the marker)

3) Email template requirement (how the URL must be in the template)
Recommended (best + most reliable)

Add this exact marker anywhere in the email body (can be near footer, small text, or hidden section):

BRIXEON_REPORT_URL:{{.URL}}/report?rid={{.RId}}


The add-in explicitly supports both : and = formats:

BRIXEON_REPORT_URL:...

BRIXEON_REPORT_URL=...

Why this marker is important

It makes reporting domain-independent, so the add-in does not need to hardcode:

simulation.ngrok.app

brixeon.com

or any specific environment

As long as the email contains the report URL, the add-in can find it.

4) Deployment (Admin Console org-wide) + how long it takes to appear
Where to deploy (Centralized Deployment)

Use Microsoft 365 admin center:

Settings → Integrated apps → Add-ins → Deploy Add-in / Upload custom apps 
Microsoft Learn

Org-wide deployment (recommended settings)

During the deploy wizard:

Upload your add-in manifest.xml

Choose Entire organization (or a specific group)

Set installation policy as needed (Admins can force install or allow users)

How long until users see it?

Microsoft notes:

It can take up to 24 hours for a centrally deployed add-in to appear for all users. 
Microsoft Learn

Users may need to restart Outlook (desktop) or refresh Outlook Web before it shows.
