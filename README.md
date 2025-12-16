# Brixeon Outlook Report Phishing Add-in

This document explains how the Brixeon Outlook Report Phishing add-in integrates with the phishing system, how users report emails, how email templates must be configured, and how the add-in is deployed organization-wide in Microsoft 365.

## 1. How the logic works with the phishing system

### High-level flow

1. A user opens an email in Outlook (Web or Desktop).
2. The user clicks **Report Phishing** from the Brixeon Outlook add-in.
3. The add-in scans the email body and extracts a reporting URL:
 ```js
/report?rid=<RID>
```
4. The add-in sends a request to the phishing system:
 ```js
GET https://<BASE_URL>/report?rid=<RID>
```

5. The phishing system:
- Resolves the RID
- Loads the correct campaign result
- Marks the email as **Reported**

### Outlook add-in: extracting the report URL (no hardcoded domain)

The Outlook add-in extractes the reporting URL using multiple fallback strategies to support different environments and template formats.

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
```

Once the URL is resolved, the add-in calls the endpoint:

```js
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

### Phishing system: how /report?rid=... is processed

When the phishing system receives the /report request:

- The rid parameter is extracted from the query string
- The system loads:
  - The related campaign
  - The recipient
  - The campaign result
- A Reported event is created
- The result status is updated and saved

```js
func ReportHandler(w http.ResponseWriter, r *http.Request) {
  r, err := setupContext(r)

  details := ctx.Get(r, "details").(EventDetails)
  err = result.HandleEmailReport(details)

  w.WriteHeader(http.StatusNoContent)
}
```
```js
func (r *Result) HandleEmailReport(details EventDetails) error {
  event, err := r.createEvent(EventReported, details)
  r.Reported = true
  r.ModifiedDate = event.Time
  return db.Save(r).Error
}
```
End result

The campaign results dashboard shows the email as Reported.

## 2. How a User Reports an Email (Usage)
### User Steps (Outlook)
1. Open the suspicious email in Outlook.
   
   <img width="1535" height="890" alt="Screenshot 2025-12-16 140647" src="https://github.com/user-attachments/assets/a945e069-7b75-4754-8f3d-cb72955a6106" />
   
3. Click the "Brixeon – Report Phishing" button.
   
   <img width="1288" height="815" alt="Screenshot 2025-12-16 140828" src="https://github.com/user-attachments/assets/bc960f34-d43a-4153-9d6f-eec2a988e86e" />
   

5. Wait for the add-in to process:

    - Scans the email body for the report URL.
    - Contacts the phishing system.
    - Displays immediate feedback.

### User Feedback Notifications
The add-in provides a clear message upon completion:

<img width="577" height="305" alt="Screenshot 2025-12-16 141327" src="https://github.com/user-attachments/assets/f1f8d1f1-a428-4982-b6c6-08780d6a6f5a" />

**Failure:** Couldn’t find a report link — this usually means the email template is missing the required reporting marker.


## 3. Email Template Requirement
### Required Marker
Every phishing email template must include the following marker to be compatible with the add-in:

Plaintext

BRIXEON_REPORT_URL:{{.BaseURL}}/report?rid={{.RId}}
Placement Options:

In the email footer.

As small or hidden text.

Anywhere in the email body.

### Why {{.BaseURL}} is Required
✅ Correct Usage ({{.BaseURL}}): Contains only the scheme + host.

Result: https://example.com/report?rid=abc123

❌ Incorrect Usage ({{.URL}}): Includes existing paths and query strings.

Result: https://example.com/login?rid=abc123/report?rid=abc123 (Invalid)

## 4. Deployment (Microsoft 365 Admin Console)
### Centralized Deployment
Administrators should deploy the add-in via the Microsoft 365 Admin Center:

Settings → Integrated apps → Add-ins → Deploy Add-in → Upload custom apps

### Recommended Settings
During the deployment wizard, ensure the following are selected:

Manifest: Upload the provided manifest.xml.

Target: Select "Entire organization".

Installation: "Force install" (Recommended).

### Availability Timeline
Propagation: Global deployment can take up to 24 hours.

Client Refresh: Users may need to restart Outlook Desktop or refresh Outlook Web to see the changes.

## Summary
Endpoint: Reports via /report?rid=...

Flexibility: No domains are hardcoded.

Template Marker: BRIXEON_REPORT_URL:{{.BaseURL}}/report?rid={{.RId}}

Availability: Org-wide rollout completes within 24 hours.





