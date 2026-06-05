import { createClient } from "@supabase/supabase-js";
import { utcNow } from "./utils.mjs";

export function createSupabaseAdmin(config) {
  return createClient(config.supabase.url, config.supabase.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function upsertListing(client, listing) {
  const timestamp = utcNow();
  const payload = {
    fingerprint: listing.fingerprint,
    source: listing.source,
    external_id: listing.external_id || null,
    normalized_url: listing.normalized_url,
    original_url: listing.url,
    title: listing.title,
    price_text: listing.price_text || null,
    price_value: listing.price_value,
    currency: listing.currency,
    location: listing.location || null,
    summary: listing.summary || null,
    raw_text: listing.raw_text || null,
    score: listing.score,
    compatibility_label: listing.compatibility_label,
    reasons_json: listing.reasons,
    attributes_json: listing.attributes || {},
    search_term: listing.search_term || null,
    last_seen_utc: timestamp,
  };

  const { data: existing } = await client
    .from("listings")
    .select("fingerprint, first_seen_utc")
    .eq("fingerprint", listing.fingerprint)
    .maybeSingle();

  payload.first_seen_utc = existing?.first_seen_utc || timestamp;

  const { error } = await client.from("listings").upsert(payload, {
    onConflict: "fingerprint",
  });
  if (error) throw error;

  const historyPayload = {
    fingerprint: listing.fingerprint,
    seen_at_utc: timestamp,
    score: listing.score,
    price_text: listing.price_text || null,
    price_value: listing.price_value,
    compatibility_label: listing.compatibility_label,
  };

  const { error: historyError } = await client.from("listing_history").insert(historyPayload);
  if (historyError) throw historyError;
}

export async function hasAlertBeenSent(client, fingerprint) {
  const { data, error } = await client
    .from("alerts")
    .select("fingerprint")
    .eq("fingerprint", fingerprint)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function recordAlert(client, listing, transport, payload) {
  const { error } = await client.from("alerts").upsert(
    {
      fingerprint: listing.fingerprint,
      transport,
      alerted_at_utc: utcNow(),
      payload_json: payload,
      acknowledged: false,
    },
    { onConflict: "fingerprint" }
  );
  if (error) throw error;
}

export async function recordRun(client, payload) {
  const { error } = await client.from("watch_runs").insert(payload);
  if (error) throw error;
}

export async function fetchDashboardStatus(client) {
  const [{ count: totalListings }, { count: pendingAlerts }, lastRunResponse, recentResponse] =
    await Promise.all([
      client.from("listings").select("*", { count: "exact", head: true }),
      client.from("alerts").select("*", { count: "exact", head: true }).eq("acknowledged", false),
      client.from("watch_runs").select("*").order("started_at_utc", { ascending: false }).limit(1).maybeSingle(),
      client
        .from("listings")
        .select("title, source, score, compatibility_label, price_text, location, original_url, reasons_json")
        .order("score", { ascending: false })
        .limit(12),
    ]);

  const recentListings =
    recentResponse.data?.map((row) => ({
      title: row.title,
      source: row.source,
      score: row.score,
      compatibility_label: row.compatibility_label,
      price_text: row.price_text,
      location: row.location,
      url: row.original_url,
      reasons: row.reasons_json || [],
    })) || [];

  const lastRun = lastRunResponse.data || null;

  return {
    total_listings: totalListings || 0,
    pending_alerts: pendingAlerts || 0,
    last_run_at: lastRun?.started_at_utc || null,
    last_run_summary: lastRun
      ? `${lastRun.compatible_count} compatible, ${lastRun.provider_count} sources responded, ${lastRun.error_count} source errors`
      : null,
    active_sources: lastRun?.provider_count || 0,
    recent_listings: recentListings,
  };
}
