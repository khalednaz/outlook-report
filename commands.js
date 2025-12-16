/* **************************************
 * Brixeon - Outlook Report Phishing Add-in (Office.js)
 * Goal: Register "Reported" event in campaign results (RID-based)
 * - No config endpoint
 * - No org token
 * - No hardcoded phish domain (read from template marker / decoded links)
 *
 * Template marker recommended:
 *   BRIXEON_REPORT_URL:{{.URL}}/report?rid={{.RId}}
 * (also supports BRIXEON_REPORT_URL=...)
 ************************************** */

(function () {
  Office.onReady(function () {});

  // The manifest calls this by name via <FunctionName>reportPhish</FunctionName>
  Office.actions.associate("reportPhish", reportPhish);

  function reportPhish(event) {
    try {
      var item = Office.context && Office.context.mailbox ? Office.context.mailbox.item : null;
      if (!item) {
        showNotification_("No message detected. Reopen the email.");
        safeComplete_(event);
        return;
      }

      // Read both HTML and Text bodies (Outlook can sanitize one of them)
      getBodyBoth_(item, function (combined) {
        if (!combined) {
          showNotification_("We couldn’t read this message body.");
          safeComplete_(event);
          return;
        }

        // Resolve /report?rid=... URL without hardcoding domains
        var reportUrl = resolveReportUrl_(combined);

        if (!reportUrl) {
          showNotification_("We couldn’t find a report link in this message. Ask your admin to add the BRIXEON_REPORT_URL marker to the email template.");
          safeComplete_(event);
          return;
        }

        // Call your Brixeon backend (/report?rid=...)
        hitReportEndpoint_(reportUrl, function (hit) {
          if (!hit.ok) {
            showNotification_("Report failed (" + hit.code + "). Please try again, or contact your administrator.");
            safeComplete_(event);
            return;
          }
          showNotification_("Reported. Thanks for helping keep your organization safe. ✅");
          safeComplete_(event);
        });
      });
    } catch (e) {
      showNotification_("Report failed. Check add-in logs.");
      safeComplete_(event);
    }
  }

  /* ===================== Body helpers ===================== */

  // Fetch BOTH bodies; some clients/tenants expose one more reliably than the other.
  function getBodyBoth_(item, cb) {
    var html = "";
    var text = "";

    item.body.getAsync(Office.CoercionType.Html, function (resHtml) {
      if (resHtml && resHtml.status === Office.AsyncResultStatus.Succeeded) {
        html = String(resHtml.value || "");
      }

      item.body.getAsync(Office.CoercionType.Text, function (resText) {
        if (resText && resText.status === Office.AsyncResultStatus.Succeeded) {
          text = String(resText.value || "");
        }
        cb(String(html) + "\n" + String(text));
      });
    });
  }

  /* ===================== Core resolver (ported from Gmail add-on) ===================== */

  /**
   * Resolve /report?rid=... URL without hardcoding the phish domain.
   *
   * Priority:
   *  1) Template marker: BRIXEON_REPORT_URL:...  OR  BRIXEON_REPORT_URL=...
   *  2) Find any URL that contains /report?rid=..., decode wrappers (Safe Links)
   *  3) Find rid in body + base URL from any rid link, then build: <base>/report?rid=<rid>
   */
  function resolveReportUrl_(combinedBody) {
    var combined = String(combinedBody || "");

    // (1) Marker (supports ":" or "=")
    var marker = extractMarkerUrlAny_(combined, "BRIXEON_REPORT_URL");
    if (marker) {
      var cleanedMarker = normalizeReportUrl_(marker);
      if (cleanedMarker) return cleanedMarker;
    }

    // (2) Direct report link anywhere
    var reportLink = findFirstUrlContaining_(combined, "/report?rid=");
    if (reportLink) {
      var cleanedReport = normalizeReportUrl_(extractDirectUrl_(reportLink));
      if (cleanedReport) return cleanedReport;
    }

    // (3) Fallback: extract rid + base from any rid link, then build /report
    var rid = extractRidFromText_(combined);
    if (!rid) return "";

    var ridLink = findFirstUrlContainingRid_(combined);
    if (!ridLink) return "";

    var cleanRidLink = extractDirectUrl_(ridLink);
    var base = getBaseUrl_(cleanRidLink);
    if (!base) return "";

    return base.replace(/\/+$/, "") + "/report?rid=" + encodeURIComponent(rid);
  }

  /**
   * Extract marker URL with either:
   *   BRIXEON_REPORT_URL: https://...
   *   BRIXEON_REPORT_URL=https://...
   * Also works if quoted:
   *   BRIXEON_REPORT_URL="https://..."
   */
  function extractMarkerUrlAny_(text, key) {
    var s = String(text || "");

    // Colon variant (more reliable)
    var reColon = new RegExp("\\b" + key + "\\s*:\\s*([\"']?)(https?:\\/\\/[^\"'\\s<>]+)\\1", "i");
    var m1 = s.match(reColon);
    if (m1 && m1.length >= 3) return String(m1[2] || "");

    // Equals variant
    var reEq = new RegExp("\\b" + key + "\\s*=\\s*([\"']?)(https?:\\/\\/[^\"'\\s<>]+)\\1", "i");
    var m2 = s.match(reEq);
    if (m2 && m2.length >= 3) return String(m2[2] || "");

    return "";
  }

  /**
   * Normalizes + validates that it is a real /report?rid=... URL.
   */
  function normalizeReportUrl_(u) {
    var url = trim_(String(u || ""));
    if (!url) return "";

    // Decode wrapped links (Outlook Safe Links / Google redirects)
    url = extractDirectUrl_(url);

    // Remove trailing punctuation
    url = url.replace(/[)\].,;]+$/, "");

    // Fix accidental double slashes (but keep https://)
    url = url.replace(/([^:])\/{2,}/g, "$1/");

    // Must be http(s)
    if (!/^https?:\/\/.+/i.test(url)) return "";

    // Must look like report endpoint with rid
    if (!/\/report\?rid=/i.test(url)) return "";

    return url;
  }

  /**
   * Finds first URL that contains a substring.
   */
  function findFirstUrlContaining_(text, needle) {
    var urls = extractAllUrls_(text);
    for (var i = 0; i < urls.length; i++) {
      var u = urls[i];
      if (String(u).indexOf(needle) !== -1) return u;
    }
    return "";
  }

  function findFirstUrlContainingRid_(text) {
    var urls = extractAllUrls_(text);
    for (var i = 0; i < urls.length; i++) {
      if (/\brid=/.test(urls[i])) return urls[i];
    }
    return "";
  }

  /**
   * Extract all http(s) URLs from text
   */
  function extractAllUrls_(text) {
    var s = String(text || "");
    var re = /https?:\/\/[^\s"'<>]+/ig;
    var out = [];
    var m;
    while ((m = re.exec(s)) !== null) {
      out.push(m[0]);
    }
    return out;
  }

  /**
   * If URL is a wrapper (Outlook Safe Links / Google redirect), decode to final destination.
   * Supports:
   *  - https://*.safelinks.protection.outlook.com/?url=<dest>
   *  - https://www.google.com/url?q=<dest>
   *  - ...?url=<dest>
   */
  function extractDirectUrl_(u) {
    var url = String(u || "");
    url = url.replace(/[)\].,;]+$/, ""); // trim trailing punctuation

    // Decode wrapper query param url= or q=
    var inner = getQueryParam_(url, "url");
    if (!inner) inner = getQueryParam_(url, "q");

    if (inner) {
      try { inner = decodeURIComponent(inner); } catch (e) {}
      // Sometimes nested encoding happens twice
      if (/^https?%3A%2F%2F/i.test(inner)) {
        try { inner = decodeURIComponent(inner); } catch (e2) {}
      }
      return inner;
    }

    return url;
  }

  function getQueryParam_(url, key) {
    try {
      var qIndex = url.indexOf("?");
      if (qIndex === -1) return "";
      var query = url.substring(qIndex + 1);
      var parts = query.split("&");
      for (var i = 0; i < parts.length; i++) {
        var kv = parts[i].split("=");
        if (kv.length < 2) continue;
        if (String(kv[0]).toLowerCase() === String(key).toLowerCase()) {
          return kv.slice(1).join("=");
        }
      }
      return "";
    } catch (e) {
      return "";
    }
  }

  /**
   * Extract rid from general text (not only links)
   */
  function extractRidFromText_(text) {
    var s = String(text || "");
    var m = s.match(/\brid=([^&"'<> \n\r\t]+)/i);
    if (!m || m.length < 2) return "";
    var raw = String(m[1] || "");
    raw = raw.replace(/[)\].,;]+$/, "");
    try { raw = decodeURIComponent(raw); } catch (e) {}
    raw = trim_(raw);
    if (!/[A-Za-z0-9]/.test(raw)) return "";
    return raw;
  }

  function getBaseUrl_(url) {
    var u = String(url || "");
    var m = u.match(/^(https?:\/\/[^\/]+)/i);
    return m ? m[1] : "";
  }

  /* ===================== Call backend (/report) ===================== */

  /**
   * Calls the phishing server report endpoint.
   * Typically returns 204 on success, but accept 200/302 too.
   */
  function hitReportEndpoint_(url, cb) {
    try {
      fetch(url, { method: "GET", redirect: "follow", credentials: "omit" })
        .then(function (resp) {
          var code = resp.status;
          var ok = (code === 204 || code === 200 || code === 302);
          cb({ ok: ok, code: code });
        })
        .catch(function (err) {
          cb({ ok: false, code: 0, err: String(err) });
        });
    } catch (e) {
      cb({ ok: false, code: 0, err: String(e) });
    }
  }

  /* ===================== UI notification ===================== */

  function showNotification_(text) {
    try {
      // Shows a toast-like message in Outlook for the currently opened email
      Office.context.mailbox.item.notificationMessages.replaceAsync("brixeonReport", {
        type: "informationalMessage",
        message: String(text || ""),
        icon: "icon-16",
        persistent: false
      });
    } catch (e) {}
  }

  function safeComplete_(event) {
    try { if (event && typeof event.completed === "function") event.completed(); } catch (e) {}
  }

  function trim_(s) {
    return String(s).replace(/^\s+|\s+$/g, "");
  }
})();
