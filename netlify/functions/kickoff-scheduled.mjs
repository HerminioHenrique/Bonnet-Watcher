export const config = {
  schedule: "*/30 * * * *",
};

export default async (_request, context) => {
  const token = process.env.BACKGROUND_RUN_TOKEN;
  const siteUrl =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    `https://${context.site.name}.netlify.app`;

  const response = await fetch(`${siteUrl}/.netlify/functions/watch-background`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ source: "scheduled" }),
  });

  return new Response(
    JSON.stringify({
      ok: response.ok,
      status: response.status,
    }),
    {
      status: response.ok ? 202 : 500,
      headers: { "content-type": "application/json" },
    }
  );
};

