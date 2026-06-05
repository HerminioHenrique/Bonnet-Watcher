import { getConfig } from "./config.mjs";
import { sendAlertIfConfigured } from "./notifier.mjs";
import { scoreListing } from "./scoring.mjs";
import { collectCandidates } from "./sources.mjs";
import {
  createSupabaseAdmin,
  fetchDashboardStatus,
  hasAlertBeenSent,
  recordAlert,
  recordRun,
  upsertListing,
} from "./supabase.mjs";
import { utcNow } from "./utils.mjs";

export async function runWatcher() {
  const config = getConfig();
  const client = createSupabaseAdmin(config);
  const startedAt = utcNow();
  const collection = await collectCandidates(config);
  const ranked = collection.candidates
    .map((candidate) => scoreListing(candidate, config))
    .sort((a, b) => b.score - a.score)
    .slice(0, 250);

  let alertCount = 0;
  for (const listing of ranked) {
    await upsertListing(client, listing);
    if (listing.score < config.watcher.minimumAlertScore) continue;
    if (await hasAlertBeenSent(client, listing.fingerprint)) continue;
    const notification = await sendAlertIfConfigured(config, listing);
    await recordAlert(client, listing, notification.transport, notification.payload);
    alertCount += 1;
  }

  await recordRun(client, {
    started_at_utc: startedAt,
    compatible_count: ranked.length,
    provider_count: collection.providerStats.length,
    error_count: collection.providerErrors.length,
    alerts_sent: alertCount,
    provider_stats_json: collection.providerStats,
    provider_errors_json: collection.providerErrors,
  });

  return {
    started_at_utc: startedAt,
    compatible_count: ranked.length,
    alerts_sent: alertCount,
    provider_stats: collection.providerStats,
    provider_errors: collection.providerErrors,
  };
}

export async function loadDashboardStatus() {
  const config = getConfig();
  const client = createSupabaseAdmin(config);
  return fetchDashboardStatus(client);
}

