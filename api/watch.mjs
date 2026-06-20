import { assertRequiredConfig, getConfig } from "../src/config.mjs";
import { runWatcher } from "../src/run-watch.mjs";

// Requer Vercel Pro ou superior para não ser cortado antes de terminar.
export const maxDuration = 300;

function isAuthorized(request, config) {
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${config.security.backgroundRunToken}`;
}

export default async function handler(request) {
  const config = getConfig();
  assertRequiredConfig(config);

  if (!["GET", "POST"].includes(request.method)) {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!isAuthorized(request, config)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runWatcher();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
