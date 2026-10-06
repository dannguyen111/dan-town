// One-time helper: get a Google Calendar refresh token so the twin can offer meeting slots.
//
//   1. In Google Cloud Console (https://console.cloud.google.com):
//        - enable the Google Calendar API
//        - OAuth consent screen: External, add yourself as a test user, then click
//          "Publish app" so it's "In production". (In "Testing", Google expires refresh
//          tokens after 7 days. Unverified is fine for your own account: you'll see a warning.)
//        - Credentials → Create OAuth client ID → "Web application", with the redirect URI
//          http://127.0.0.1:8889/callback
//   2. GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/google-auth.mjs
//   3. Open the printed URL, sign in with the account whose calendar should be used, approve,
//      then store the values as Worker secrets (run inside workers/api):
//        npx wrangler secret put GOOGLE_CLIENT_ID
//        npx wrangler secret put GOOGLE_CLIENT_SECRET
//        npx wrangler secret put GOOGLE_REFRESH_TOKEN
//        npx wrangler secret put BOOKING_SECRET          (any long random string)
//
// Scopes: calendar.freebusy (busy times only, never event details) and calendar.events (to
// create the event once you approve a request). Nothing is written to disk.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.");
  process.exit(1);
}

const redirect = "http://127.0.0.1:8889/callback";
const state = randomBytes(16).toString("hex");
const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
auth.search = new URLSearchParams({
  client_id: id,
  response_type: "code",
  redirect_uri: redirect,
  scope: "https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events",
  // offline + consent: always return a refresh token, even if you authorized before.
  access_type: "offline",
  prompt: "consent",
  state,
}).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", redirect);
  if (url.pathname !== "/callback") return res.writeHead(404).end();
  if (url.searchParams.get("state") !== state) return res.writeHead(400).end("State mismatch.");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: url.searchParams.get("code") ?? "",
      redirect_uri: redirect,
      client_id: id,
      client_secret: secret,
    }),
  });
  const body = await tokenRes.json();
  if (!body.refresh_token) {
    res.writeHead(500).end("Token exchange failed. Check the terminal.");
    console.error(body);
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" }).end("Done! You can close this tab.");
    console.log(`\nGOOGLE_REFRESH_TOKEN=${body.refresh_token}\n`);
  }
  server.close();
});

server.listen(8889, "127.0.0.1", () => console.log(`Open this URL to authorize:\n\n${auth}\n`));
