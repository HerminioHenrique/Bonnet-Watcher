import { extractPriceValue, makeFingerprint, normalizeUrl, normalizeWhitespace } from "./utils.mjs";

function containsAny(text, keywords) {
  const normalized = text.toLowerCase();
  return keywords.filter((keyword) => normalized.includes(keyword.toLowerCase()));
}

export function scoreListing(candidate, config) {
  const haystack = normalizeWhitespace(
    [
      candidate.title,
      candidate.summary,
      candidate.location,
      candidate.raw_text,
      Object.values(candidate.attributes || {}).join(" "),
    ].join(" ")
  );

  const { priceValue, currency } = extractPriceValue(candidate.price_text);
  candidate.price_value = priceValue;
  candidate.currency = currency;

  let score = 0;
  const reasons = [];

  const matchedParts = containsAny(haystack, config.search.partNumbers);
  if (matchedParts.length) {
    score += 60 + (matchedParts.length - 1) * 10;
    reasons.push(`Matched part number(s): ${matchedParts.join(", ")}`);
  }

  if (/renault/i.test(haystack) && /zoe/i.test(haystack)) {
    score += 20;
    reasons.push("Mentions Renault Zoe");
  }

  const matchedBodyTerms = containsAny(haystack, ["bonnet", "hood"]);
  if (matchedBodyTerms.length) {
    score += 12;
    reasons.push(`Mentions bonnet/hood: ${matchedBodyTerms.join(", ")}`);
  }

  const matchedPriority = containsAny(haystack, config.search.priorityKeywords);
  if (matchedPriority.length) {
    score += matchedPriority.length * 8;
    reasons.push(`Contains facelift/ZE50/year terms: ${matchedPriority.join(", ")}`);
  }

  const matchedColors = containsAny(haystack, config.search.colorKeywords);
  if (matchedColors.length) {
    score += 15;
    reasons.push(`Color clue found: ${matchedColors.join(", ")}`);
  }

  if (priceValue !== null && currency === "GBP") {
    if (priceValue <= config.watcher.maxPriceGbp) {
      score += 12;
      reasons.push(`Price within target limit (${candidate.price_text})`);
    } else if (priceValue <= config.watcher.maxPriceGbp * 1.25) {
      score += 4;
      reasons.push(`Price slightly above target limit (${candidate.price_text})`);
    } else {
      score -= 10;
      reasons.push(`Price well above target limit (${candidate.price_text})`);
    }
  }

  const normalizedUrl = normalizeUrl(candidate.url);
  const fingerprint = makeFingerprint(candidate.source, normalizedUrl, candidate.external_id);

  let compatibilityLabel = "Very low";
  if (score >= 95) compatibilityLabel = "Very high";
  else if (score >= 75) compatibilityLabel = "High";
  else if (score >= 55) compatibilityLabel = "Medium";
  else if (score >= 35) compatibilityLabel = "Low";

  return {
    ...candidate,
    score: Math.max(0, Number(score.toFixed(2))),
    compatibility_label: compatibilityLabel,
    reasons,
    normalized_url: normalizedUrl,
    fingerprint,
  };
}

