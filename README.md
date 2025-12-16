# Brixeon Outlook Report Phishing Add-in

This document explains how the Brixeon Outlook Report Phishing add-in integrates with the phishing system, how users report emails, how email templates must be configured, and how the add-in is deployed organization-wide in Microsoft 365.

## 1. How the logic works with the phishing system

### High-level flow

1. A user opens an email in Outlook (Web or Desktop).
2. The user clicks **Report Phishing** from the Brixeon Outlook add-in.
3. The add-in scans the email body and extracts a reporting URL:

/report?rid=<RID>

csharp
Copy code

4. No domain is hardcoded.
5. The add-in sends a request to the phishing system:

GET https://<BASE_URL>/report?rid=<RID>

csharp
Copy code

6. The phishing system:
- Resolves the RID
- Loads the correct campaign result
- Marks the email as **Reported**

### Outlook add-in: resolving the report URL (no hardcoded domain)

The Outlook add-in resolves the reporting URL using multiple fallback strategies to support different environments and template formats.

```js
function resolveReportUrl_(combinedBody) {
// (1) Marker: BRIXEON_REPORT_URL:... or BRIXEON_REPORT_URL=...
var marker = extractMarkerUrlAny_(combinedBody, "BRIXEON_REPORT_URL");
if (marker) return normalizeReportUrl_(marker);

// (2) Any URL containing /report?rid=
var reportLink = findFirstUrlContaining_(combinedBody, "/report?rid=");
if (reportLink) return normalizeReportUrl_(extractDirectUrl_(reportLink));

// (3) Fallback: extract rid + base from any rid link, then build /report
var rid = extractRidFromText_(combinedBody);
var ridLink = findFirstUrlContainingRid_(combinedBody);
var base = getBaseUrl_(extractDirectUrl_(ridLink));

return base.replace(/\/+$/, "") + "/report?rid=" + encodeURIComponent(rid);
}
Once the URL is resolved, the add-in calls the endpoint:

js
Copy code
function hitReportEndpoint_(url, cb) {
  fetch(url, {
    method: "GET",
    redirect: "follow",
    credentials: "omit"
  })
    .then(function (resp) {
      var ok = (resp.status === 204 || resp.status === 200 || resp.status === 302);
      cb({ ok: ok, code: resp.status });
    })
    .catch(function (err) {
      cb({ ok: false, code: 0, err: String(err) });
    });
}

```
```text
Phishing system: how /report?rid=... is processed

When the phishing system receives the /report request:

- The rid parameter is extracted from the query string
- The system loads:
  - The related campaign
  - The recipient
  - The campaign result
- A Reported event is created
- The result status is updated and saved


func ReportHandler(w http.ResponseWriter, r *http.Request) {
  r, err := setupContext(r)

  details := ctx.Get(r, "details").(EventDetails)
  err = result.HandleEmailReport(details)

  w.WriteHeader(http.StatusNoContent)
}
```
go
Copy code
func (r *Result) HandleEmailReport(details EventDetails) error {
  event, err := r.createEvent(EventReported, details)
  r.Reported = true
  r.ModifiedDate = event.Time
  return db.Save(r).Error
}
End result

The campaign results dashboard shows the email as Reported.

2. How a user reports an email (usage)
User steps (Outlook)
Open the suspicious email in Outlook.

Click Brixeon – Report Phishing.

The add-in:

Reads the email body

Finds the report URL

Calls the phishing system

Displays feedback to the user

What the user sees
Success

nginx
Copy code
Reported successfully
Failure

arduino
Copy code
Couldn’t find a report link
Failures typically indicate that the email template is missing the required reporting marker.

3. Email template requirement
Required marker in the email template
Every phishing email must include the following marker:

bash
Copy code
BRIXEON_REPORT_URL:{{.BaseURL}}/report?rid={{.RId}}
This marker may be placed:

In the footer

In small or hidden text

Anywhere in the email body

The add-in supports both formats:

BRIXEON_REPORT_URL:...

BRIXEON_REPORT_URL=...

Why this marker is required
Prevents hardcoding domains

Works across:

Production

Staging

Testing

Allows the add-in to dynamically locate the reporting endpoint

Why {{.URL}} must not be used
{{.URL}} already includes a path and query string.

Using it can produce invalid URLs such as:

bash
Copy code
https://example.com/login?rid=abc123/report?rid=abc123
Why {{.BaseURL}} is correct
{{.BaseURL}} contains only:

nginx
Copy code
scheme + host
Resulting in a clean reporting URL:

arduino
Copy code
https://example.com/report?rid=abc123
4. Deployment (Microsoft 365 Admin Console)
Centralized deployment
Deploy the Outlook add-in via the Microsoft 365 Admin Center:

powershell
Copy code
Settings → Integrated apps → Add-ins
→ Deploy Add-in / Upload custom apps
Recommended deployment settings
During the deployment wizard:

Upload manifest.xml

Select Entire organization (or a specific group)

Choose installation behavior:

Force install (recommended), or

Allow users to install

When users will see the add-in
Organization-wide deployments can take up to 24 hours

This delay is expected and normal

Users may need to:

Restart Outlook Desktop

Refresh Outlook Web

Expected appearance time: within one day

Summary
The Outlook add-in reports phishing using /report?rid=...

No domains are hardcoded

Email templates must include:

bash
Copy code
BRIXEON_REPORT_URL:{{.BaseURL}}/report?rid={{.RId}}
Deployment is handled centrally via Microsoft 365

Organization-wide availability may take up to 24 hours

markdown
Copy code

---

### Why this will now work
- Uses **only GitHub-supported Markdown**
- Matches the syntax in the docs you linked
- Renders cleanly on GitHub
- No mixed formatting
- No visual hacks
- No surprises

If you want, next we can:
- Reduce verbosity (shorter README)
- Split into `/docs/` files
- Create a **customer-facing** vs **internal** version

But structurally — **this is now correct GitHub Markdown**.






