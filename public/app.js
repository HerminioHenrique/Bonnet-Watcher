async function loadStatus() {
  const response = await fetch("/.netlify/functions/status");
  if (!response.ok) {
    throw new Error(`Status request failed with ${response.status}`);
  }
  return response.json();
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function renderListing(item) {
  const reasons = Array.isArray(item.reasons) ? item.reasons : [];
  return `
    <article class="listing">
      <h3>${item.title}</h3>
      <div class="meta">
        <span class="pill">${item.compatibility_label} · ${item.score}</span>
        <span>${item.source}</span>
        <span>${item.price_text || "Price N/A"}</span>
        <span>${item.location || "Location N/A"}</span>
      </div>
      <p><a href="${item.url}" target="_blank" rel="noreferrer">Open listing</a></p>
      <ul class="reasons">
        ${reasons.map((reason) => `<li>${reason}</li>`).join("")}
      </ul>
    </article>
  `;
}

async function main() {
  const lastRun = document.getElementById("last-run");
  const lastRunMeta = document.getElementById("last-run-meta");
  const candidateCount = document.getElementById("candidate-count");
  const alertCount = document.getElementById("alert-count");
  const sourceCount = document.getElementById("source-count");
  const listings = document.getElementById("listings");

  try {
    const status = await loadStatus();
    lastRun.textContent = formatDate(status.last_run_at);
    lastRunMeta.textContent = status.last_run_summary || "No summary available";
    candidateCount.textContent = String(status.total_listings ?? 0);
    alertCount.textContent = String(status.pending_alerts ?? 0);
    sourceCount.textContent = String(status.active_sources ?? 0);

    if (!status.recent_listings?.length) {
      listings.innerHTML = '<div class="empty">No compatible listing has been saved yet.</div>';
      return;
    }

    listings.innerHTML = status.recent_listings.map(renderListing).join("");
  } catch (error) {
    listings.innerHTML = `<div class="empty">${error.message}</div>`;
  }
}

main();

