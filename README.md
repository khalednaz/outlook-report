Brixeon Outlook Report Phishing Add-in
This repository contains the documentation and logic for the Brixeon Outlook Report Phishing add-in. It explains how the add-in integrates with the phishing system, user reporting workflows, template requirements, and Microsoft 365 deployment.

## 1. System Logic & Integration
The add-in functions by dynamically identifying reporting endpoints within an email body to avoid hardcoded domains.

### High-Level Flow
User Action: A user opens an email in Outlook (Web or Desktop) and clicks "Report Phishing" via the Brixeon add-in.

Scanning: The add-in scans the email body to extract a reporting URL: /report?rid=<RID>.

Request: The add-in sends a GET request to https://<BASE_URL>/report?rid=<RID>.

Backend Processing: The phishing system resolves the RID, loads the campaign results, and marks the email as Reported.

### URL Resolution Strategy
The add-in uses multiple fallback strategies to resolve the URL:

JavaScript

function resolveReportUrl_(combinedBody) {
  // (1) Specific Marker: BRIXEON_REPORT_URL:... or BRIXEON_REPORT_URL=...
  var marker = extractMarkerUrlAny_(combinedBody, "BRIXEON_REPORT_URL");
  if (marker) return normalizeReportUrl_(marker);

  // (2) Search for path containing /report?rid=
  var reportLink = findFirstUrlContaining_(combinedBody, "/report?rid=");
  if (reportLink) return normalizeReportUrl_(extractDirectUrl_(reportLink));

  // (3) Reconstruct from base domain and extracted rid
  var rid = extractRidFromText_(combinedBody);
  var ridLink = findFirstUrlContainingRid_(combinedBody);
  var base = getBaseUrl_(extractDirectUrl_(ridLink));

  return base.replace(/\/+$/, "") + "/report?rid=" + encodeURIComponent(rid);
}
## 2. User Experience (Usage)
### Reporting Steps
Open the suspicious email in Outlook.

Click Brixeon – Report Phishing.

The add-in reads the body, finds the URL, and contacts the system.

### Feedback Messages
Success: Reported successfully.

Failure: Couldn’t find a report link (Usually indicates a missing template marker).

## 3. Email Template Requirement
[!IMPORTANT] Every phishing email must include a reporting marker to function with the add-in.

### Required Marker
Add this to your template footer or as hidden text: BRIXEON_REPORT_URL:{{.BaseURL}}/report?rid={{.RId}}

### Why use {{.BaseURL}}?
Correct ({{.BaseURL}}): Contains only the scheme and host, resulting in a clean URL: https://example.com/report?rid=abc123.

Incorrect ({{.URL}}): Includes existing paths and query strings, which can create invalid, nested URLs.

## 4. Deployment Guide
### Centralized Deployment (M365)
Administrators can deploy the add-in via the Microsoft 365 Admin Center:

Go to Settings → Integrated apps → Add-ins.

Select Deploy Add-in and Upload custom apps.

### Recommended Settings
File: Upload the manifest.xml.

Users: Select Entire organization.

Behavior: Force install (recommended).

### Propagation Time
Expected Delay: Organization-wide deployments can take up to 24 hours to appear.

User Action: Users may need to restart their Outlook Desktop client or refresh Outlook Web.
