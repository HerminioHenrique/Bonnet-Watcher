import * as cheerio from "cheerio";
import { normalizeUrl, normalizeWhitespace } from "./utils.mjs";

const DEFAULT_HEADERS = {
  "accept-language": "en-GB,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
};

function makeCandidate(source, searchTerm, title, url, extra = {}) {
  return {
    source,
    search_term: searchTerm,
    title: normalizeWhitespace(title),
    url: normalizeUrl(url),
    price_text: normalizeWhitespace(extra.price_text || ""),
    location: normalizeWhitespace(extra.location || ""),
    summary: normalizeWhitespace(extra.summary || ""),
    raw_text: normalizeWhitespace(extra.raw_text || ""),
    external_id: extra.external_id || "",
    attributes: extra.attributes || {},
  };
}

function looksRelevant(text, config) {
  const normalized = normalizeWhitespace(text).toLowerCase();
  const hasVehicle = normalized.includes("renault") && normalized.includes("zoe");
  const hasPart = config.search.partNumbers.some((part) => normalized.includes(part.toLowerCase()));
  const hasPanel = normalized.includes("bonnet") || normalized.includes("hood");
  return hasPart || (hasVehicle && hasPanel);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function getEbayApplicationToken(config) {
  if (!config.ebay.clientId || !config.ebay.clientSecret) {
    throw new Error("Missing eBay API credentials");
  }

  const basic = Buffer.from(`${config.ebay.clientId}:${config.ebay.clientSecret}`).toString("base64");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    throw new Error(`eBay OAuth HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error("eBay OAuth token missing in response");
  }

  return payload.access_token;
}

async function searchEbayApi(term, config, accessToken) {
  const params = new URLSearchParams({
    q: term,
    limit: String(config.watcher.maxResultsPerQuery),
    sort: "newlyListed",
    filter: "deliveryCountry:GB",
  });

  const response = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-EBAY-C-MARKETPLACE-ID": config.ebay.marketplaceId,
      "Accept-Language": "en-GB",
    },
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    throw new Error(`eBay Browse API HTTP ${response.status}`);
  }

  const payload = await response.json();
  const summaries = payload.itemSummaries || [];
  const items = [];

  for (const summary of summaries) {
    const title = normalizeWhitespace(summary.title || "");
    const url = normalizeWhitespace(summary.itemWebUrl || "");
    const textBundle = `${title} ${summary.shortDescription || ""}`;
    if (!title || !url || !looksRelevant(textBundle, config)) continue;

    items.push(
      makeCandidate("ebay_uk", term, title, url, {
        price_text:
          summary.price?.value && summary.price?.currency
            ? `${summary.price.currency === "GBP" ? "£" : summary.price.currency} ${summary.price.value}`
            : "",
        location: summary.itemLocation?.country || "",
        summary: normalizeWhitespace(summary.shortDescription || ""),
        raw_text: normalizeWhitespace(JSON.stringify(summary)),
        external_id: parseEbayItemId(url),
        attributes: {
          format: "ebay_api",
          buyingOptions: (summary.buyingOptions || []).join("|"),
          condition: summary.condition || "",
        },
      })
    );
  }

  return items;
}

function parseGoogleLinksFromHtml(html, { source, searchTerm, config, domainIncludes }) {
  const $ = cheerio.load(html);
  const items = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const resolved = normalizeUrl(href || "");
    if (!resolved) return;
    if (!resolved.includes(domainIncludes)) return;

    const title =
      normalizeWhitespace($(element).find("h3").first().text()) ||
      normalizeWhitespace($(element).text());
    const container = $(element).closest("div, article, li");
    const raw = normalizeWhitespace(container.text() || title);
    if (!title || !looksRelevant(`${title} ${raw}`, config)) return;

    items.push(
      makeCandidate(source, searchTerm, title, resolved, {
        summary: raw.slice(0, 500),
        raw_text: raw,
        external_id: parseEbayItemId(resolved),
        attributes: {
          format: "google_fallback",
        },
      })
    );
  });

  return items;
}

function parseRssDescription(description = "") {
  const $ = cheerio.load(description || "");
  const text = normalizeWhitespace($.text());
  const priceMatch = text.match(/(?:£|GBP)\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?/i);
  const locationMatch =
    text.match(/(?:from|located in|item location:)\s*([A-Za-z0-9,\- ]{2,80})/i) ||
    text.match(/([A-Za-z][A-Za-z,\- ]{2,60},\s*(?:United Kingdom|UK))/i);

  return {
    summary: text.slice(0, 500),
    raw_text: text,
    price_text: priceMatch ? priceMatch[0] : "",
    location: locationMatch ? locationMatch[1] : "",
  };
}

function parseEbayItemId(url = "") {
  const match = url.match(/\/itm\/(?:[^/]*\/)?(\d+)/i);
  return match ? match[1] : "";
}

async function searchEbayRss(term, config) {
  const rssUrl =
    `https://www.ebay.co.uk/dsc/i.html?_nkw=${encodeURIComponent(term)}` +
    `&_rss=1&_ipg=${config.watcher.maxResultsPerQuery}&rt=nc&_sop=10`;
  const xml = await fetchHtml(rssUrl);
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  $("item").each((_, element) => {
    const title = normalizeWhitespace($(element).find("title").first().text());
    const link = normalizeWhitespace($(element).find("link").first().text());
    const description = $(element).find("description").first().text();
    const textBundle = `${title} ${description}`;
    if (!title || !link || !looksRelevant(textBundle, config)) return;

    const parsed = parseRssDescription(description);
    items.push(
      makeCandidate("ebay_uk", term, title, link, {
        ...parsed,
        external_id: parseEbayItemId(link),
        attributes: {
          format: "rss",
        },
      })
    );
  });

  return items;
}

async function searchEbay(config) {
  const source = "ebay_uk";
  const items = [];
  const stats = { source, queries_attempted: 0, matched_results: 0, query_errors: 0 };
  let ebayApiToken = null;

  if (config.ebay.clientId && config.ebay.clientSecret) {
    try {
      ebayApiToken = await getEbayApplicationToken(config);
    } catch {}
  }

  for (const term of config.search.terms) {
    stats.queries_attempted += 1;
    try {
      let termItems = [];
      let resolved = false;

      if (ebayApiToken) {
        try {
          termItems = await searchEbayApi(term, config, ebayApiToken);
          resolved = true;
        } catch {}
      }

      try {
        if (!resolved || termItems.length === 0) {
          termItems = await searchEbayRss(term, config);
          resolved = true;
        }
      } catch {}

      if (!resolved) {
        try {
          const html = await fetchHtml(
            `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(term)}&_sop=10`
          );
          const $ = cheerio.load(html);
          $("li.s-item").each((_, element) => {
            const title = $(element).find(".s-item__title").first().text();
            const href = $(element).find("a.s-item__link").first().attr("href");
            const raw = $(element).text();
            if (!title || !href || !looksRelevant(`${title} ${raw}`, config)) return;
            termItems.push(
              makeCandidate(source, term, title, href, {
                price_text: $(element).find(".s-item__price").first().text(),
                location: $(element).find(".s-item__location").first().text(),
                summary: $(element).find(".s-item__subtitle").first().text(),
                raw_text: raw,
                external_id: parseEbayItemId(href),
                attributes: {
                  format: "html",
                },
              })
            );
          });
          resolved = true;
        } catch {}
      }

      if (!resolved || termItems.length === 0) {
        const html = await fetchHtml(
          `https://www.google.co.uk/search?hl=en&gl=uk&q=${encodeURIComponent(`site:ebay.co.uk/itm ${term}`)}`
        );
        termItems.push(
          ...parseGoogleLinksFromHtml(html, {
            source,
            searchTerm: term,
            config,
            domainIncludes: "ebay.co.uk/itm/",
          })
        );
        resolved = true;
      }

      items.push(...termItems);
      stats.matched_results += termItems.length;
    } catch {
      stats.query_errors += 1;
    }
  }

  return { items, stats };
}

async function searchGumtree(config) {
  const source = "gumtree_uk";
  const items = [];
  const stats = { source, queries_attempted: 0, matched_results: 0, query_errors: 0 };

  for (const term of config.search.terms) {
    stats.queries_attempted += 1;
    try {
      const html = await fetchHtml(`https://www.gumtree.com/search?search_category=all&q=${encodeURIComponent(term)}`);
      const $ = cheerio.load(html);
      let termMatches = 0;
      $("a[href*='/p/']").each((_, element) => {
        const href = $(element).attr("href");
        const title = $(element).text();
        const container = $(element).closest("article, li, div");
        const raw = container.text() || title;
        if (!href || !title || !looksRelevant(`${title} ${raw}`, config)) return;
        items.push(
          makeCandidate(source, term, title, `https://www.gumtree.com${href}`, {
            summary: raw,
            raw_text: raw,
          })
        );
        termMatches += 1;
      });
      stats.matched_results += termMatches;
    } catch {
      stats.query_errors += 1;
    }
  }

  return { items, stats };
}

async function searchBParts(config) {
  const source = "b_parts_uk";
  const items = [];
  const stats = { source, queries_attempted: 0, matched_results: 0, query_errors: 0 };

  for (const term of config.search.terms) {
    stats.queries_attempted += 1;
    try {
      const html = await fetchHtml(`https://www.b-parts.com/auto-parts/search?query=${encodeURIComponent(term)}`);
      const $ = cheerio.load(html);
      let termMatches = 0;
      $("a[href*='/auto-parts/']").each((_, element) => {
        const href = $(element).attr("href");
        if (!href || href.includes("/search")) return;
        const title = $(element).text();
        const container = $(element).closest("article, li, div");
        const raw = container.text() || title;
        if (!title || !looksRelevant(`${title} ${raw}`, config)) return;
        items.push(
          makeCandidate(source, term, title, `https://www.b-parts.com${href}`, {
            summary: raw,
            raw_text: raw,
          })
        );
        termMatches += 1;
      });
      stats.matched_results += termMatches;
    } catch {
      stats.query_errors += 1;
    }
  }

  return { items, stats };
}

async function searchGoogle(config, shopping = false) {
  const source = shopping ? "google_shopping_uk" : "google_search_uk";
  const items = [];
  const stats = { source, queries_attempted: 0, matched_results: 0, query_errors: 0 };

  for (const term of config.search.terms) {
    stats.queries_attempted += 1;
    try {
      const base = shopping
        ? `https://www.google.co.uk/search?hl=en&gl=uk&tbm=shop&q=${encodeURIComponent(term)}`
        : `https://www.google.co.uk/search?hl=en&gl=uk&q=${encodeURIComponent(term)}`;
      const html = await fetchHtml(base);
      const $ = cheerio.load(html);
      let termMatches = 0;
      $("a[href]").each((_, element) => {
        const href = $(element).attr("href");
        const resolved = normalizeUrl(href || "");
        if (!resolved || resolved.includes("google.co.uk/search")) return;
        const title = $(element).find("h3").first().text() || $(element).text();
        const container = $(element).closest("div, article, li");
        const raw = container.text() || title;
        if (!title || !looksRelevant(`${title} ${raw}`, config)) return;
        items.push(
          makeCandidate(source, term, title, resolved, {
            summary: raw,
            raw_text: raw,
          })
        );
        termMatches += 1;
      });
      stats.matched_results += termMatches;
    } catch {
      stats.query_errors += 1;
    }
  }

  return { items, stats };
}

export async function collectCandidates(config) {
  const enabled = config.search.sources;
  const tasks = [];
  if (enabled.ebay_uk) tasks.push(searchEbay(config));
  if (enabled.gumtree_uk) tasks.push(searchGumtree(config));
  if (enabled.b_parts_uk) tasks.push(searchBParts(config));
  if (enabled.google_shopping_uk) tasks.push(searchGoogle(config, true));
  if (enabled.google_search_uk) tasks.push(searchGoogle(config, false));

  const settled = await Promise.allSettled(tasks);
  const items = [];
  const stats = [];
  const providerErrors = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      items.push(...result.value.items);
      stats.push(result.value.stats);
    } else {
      providerErrors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  const unique = new Map();
  for (const item of items) {
    const key = `${item.source}|${item.url}`;
    if (!unique.has(key)) unique.set(key, item);
  }

  return {
    candidates: [...unique.values()],
    providerStats: stats,
    providerErrors,
  };
}
