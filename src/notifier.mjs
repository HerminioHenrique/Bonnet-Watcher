import nodemailer from "nodemailer";

function buildListingMessage(listing) {
  return [
    "Zoe Bonnet Watcher found a new online candidate",
    `Title: ${listing.title}`,
    `Price: ${listing.price_text || "N/A"}`,
    `Estimated compatibility: ${listing.compatibility_label} (${listing.score})`,
    `Source: ${listing.source}`,
    `Location: ${listing.location || "N/A"}`,
    `Relevant info: ${(listing.reasons || []).slice(0, 5).join("; ")}`,
    `Link: ${listing.url}`,
  ].join("\n");
}

export async function sendAlertIfConfigured(config, listing) {
  if (!config.notifications.emailEnabled) {
    return {
      transport: "dashboard_queue",
      payload: { delivered: false, reason: "email_disabled" },
    };
  }

  const transporter = nodemailer.createTransport({
    host: config.notifications.smtpHost,
    port: config.notifications.smtpPort,
    secure: config.notifications.smtpSecure,
    auth: {
      user: config.notifications.smtpUser,
      pass: config.notifications.smtpPass,
    },
  });

  const message = buildListingMessage(listing);
  const info = await transporter.sendMail({
    from: config.notifications.smtpFrom,
    to: config.notifications.emailTo,
    subject: `[IMPORTANT] Zoe bonnet candidate: ${listing.compatibility_label} - ${listing.title}`,
    text: message,
    priority: "high",
    headers: {
      Importance: "high",
      Priority: "urgent",
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
    },
  });

  return {
    transport: "smtp_email",
    payload: {
      delivered: true,
      message_id: info.messageId,
      recipient: config.notifications.emailTo,
    },
  };
}

export async function sendTestAlert(config) {
  return sendAlertIfConfigured(config, {
    title: "Test listing",
    price_text: "£123",
    compatibility_label: "High",
    score: 88,
    source: "test",
    location: "Test",
    reasons: ["SMTP test message"],
    url: "https://example.com/test",
  });
}
