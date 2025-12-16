Brixeon Outlook Add-in (Report Phishing)

This Outlook add-in allows users to report simulated phishing emails directly from Outlook.
It integrates with the phishing system using the same reporting logic used across Brixeon platforms.

How it works
High-level flow

User opens an email in Outlook (Web or Desktop)

User clicks Report Phishing

The add-in reads the email body (HTML + Text)

A reporting URL is resolved without hardcoding the domain

The add-in calls:

GET <base>/report?rid=<rid>


The phishing system resolves the result and marks it as Reported

Resolving the report URL

The add-in resolves the report URL using the following priority:

A marker in the email body

BRIXEON_REPORT_URL:

BRIXEON_REPORT_URL=

Any URL containing:

/report?rid=


Fallback:

Extract rid= from any link

Extract the base domain

Build:

<base>/report?rid=<rid>

Core logic (commands.js)
function resolveReportUrl_(combinedBody) {
  // 1) Marker-based resolution
  var marker = extractMarkerUrlAny_(combinedBody, "BRIXEON_REPORT_URL");
  if (marker) return normalizeReportUrl_(marker);

  // 2) Direct /report?rid= link
  var reportLink = findFirstUrlContaining_(combinedBody, "/report?rid=");
  if (reportLink) return normalizeReportUrl_(extractDirectUrl_(reportLink));

  // 3) Fallback: build report URL from rid
  var rid = extractRidFromText_(combinedBody);
  var ridLink = findFirstUrlContainingRid_(combinedBody);
  var base =


ChatGPT can make mistakes. Check important info.
