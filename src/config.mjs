import "dotenv/config";

export function getConfig() {
  return {
    watcher: {
      intervalMinutes: Number(process.env.WATCHER_INTERVAL_MINUTES || 30),
      maxPriceGbp: Number(process.env.MAX_PRICE_GBP || 850),
      minimumAlertScore: Number(process.env.MINIMUM_ALERT_SCORE || 60),
      maxResultsPerQuery: Number(process.env.MAX_RESULTS_PER_QUERY || 10),
      maxAlertsPerRun: Number(process.env.MAX_ALERTS_PER_RUN || 5),
    },
    supabase: {
      url: process.env.SUPABASE_URL || "",
      secretKey:
        process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        "",
      publishableKey:
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        "",
    },
    security: {
      backgroundRunToken: process.env.BACKGROUND_RUN_TOKEN || "",
    },
    notifications: {
      emailEnabled: String(process.env.ALERT_EMAIL_ENABLED || "false").toLowerCase() === "true",
      emailTo: process.env.ALERT_EMAIL_TO || "herminiohuk@gmail.com",
      smtpHost: process.env.SMTP_HOST || "",
      smtpPort: Number(process.env.SMTP_PORT || 587),
      smtpSecure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
      smtpUser: process.env.SMTP_USER || "",
      smtpPass: process.env.SMTP_PASS || "",
      smtpFrom: process.env.SMTP_FROM || "",
    },
    ebay: {
      clientId: process.env.EBAY_CLIENT_ID || "",
      clientSecret: process.env.EBAY_CLIENT_SECRET || "",
      marketplaceId: process.env.EBAY_MARKETPLACE_ID || "EBAY_GB",
    },
    search: {
      partNumbers: ["651227811", "651227811R", "651004516R"],
      terms: [
        "651227811",
        "651227811R",
        "651004516R",
        "Renault Zoe bonnet",
        "Renault Zoe facelift bonnet",
        "Renault Zoe ZE50 bonnet",
        "Renault Zoe 2021 bonnet",
        "Renault Zoe hood",
        "Renault Zoe facelift hood",
        "Renault Zoe ZE50 hood"
      ],
      colorKeywords: ["TEKQA", "KQA", "Silver", "Grey", "Gray"],
      priorityKeywords: ["ZE50", "Facelift", "2020+", "2021", "2022", "2023", "2024"],
      sources: {
        ebay_uk: true,
        gumtree_uk: true,
        b_parts_uk: false, // blocked by AWS WAF — requires real browser (use local Python version)
        google_shopping_uk: true,
        google_search_uk: true
      }
    }
  };
}

export function assertRequiredConfig(config) {
  const missing = [];
  if (!config.supabase.url) missing.push("SUPABASE_URL");
  if (!config.supabase.secretKey) missing.push("SUPABASE_SECRET_KEY");
  if (!config.security.backgroundRunToken) missing.push("BACKGROUND_RUN_TOKEN");
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}
