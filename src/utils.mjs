import crypto from "node:crypto";

export function normalizeWhitespace(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

export function extractPriceValue(priceText = "") {
  const text = normalizeWhitespace(priceText);
  if (!text) return { priceValue: null, currency: null };

  let currency = null;
  if (text.includes("£") || text.toUpperCase().includes("GBP")) currency = "GBP";
  if (text.includes("€") || text.toUpperCase().includes("EUR")) currency = "EUR";

  const match = text.match(/([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/);
  if (!match) return { priceValue: null, currency };

  const numeric = match[1].replace(/[,\s]/g, "");
  const parsed = Number(numeric);
  return { priceValue: Number.isFinite(parsed) ? parsed : null, currency };
}

export function normalizeUrl(value = "") {
  const text = normalizeWhitespace(value);
  if (!text) return "";
  try {
    if (text.startsWith("/url?")) {
      const parsedShort = new URL(`https://www.google.co.uk${text}`);
      const target = parsedShort.searchParams.get("q");
      if (target) return normalizeUrl(decodeURIComponent(target));
    }

    const parsed = new URL(text);
    parsed.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) =>
      parsed.searchParams.delete(key)
    );
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return text;
  }
}

export function makeFingerprint(source, url, externalId = "") {
  const raw = `${source}|${externalId || url}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function utcNow() {
  return new Date().toISOString();
}

