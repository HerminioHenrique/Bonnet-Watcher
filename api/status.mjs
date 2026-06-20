import { assertRequiredConfig, getConfig } from "../src/config.mjs";
import { loadDashboardStatus } from "../src/run-watch.mjs";

export default async function handler() {
  const config = getConfig();
  assertRequiredConfig(config);

  try {
    const status = await loadDashboardStatus();
    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
