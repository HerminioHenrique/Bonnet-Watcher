import { assertRequiredConfig, getConfig } from "../src/config.mjs";
import { sendTestAlert } from "../src/notifier.mjs";

export default async function handler(request) {
  const config = getConfig();
  assertRequiredConfig(config);

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${config.security.backgroundRunToken}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await sendTestAlert(config);
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
