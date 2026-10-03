// One-time helper: get a Spotify refresh token for the Music Room.
//
//   1. Create an app at https://developer.spotify.com/dashboard
//      and add the redirect URI  http://127.0.0.1:8888/callback
//   2. SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... node scripts/spotify-auth.mjs
//   3. Open the printed URL, approve, then store the three values as Worker secrets:
//        npx wrangler secret put SPOTIFY_CLIENT_ID      (run inside workers/api)
//        npx wrangler secret put SPOTIFY_CLIENT_SECRET
//        npx wrangler secret put SPOTIFY_REFRESH_TOKEN
//   4. Set `integrations.spotify.enabled: true` in profile.yaml.
//
// Nothing is written to disk. The token is printed to your terminal only.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.");
  process.exit(1);
}

const redirect = "http://127.0.0.1:8888/callback";
const state = randomBytes(16).toString("hex");
const auth = new URL("https://accounts.spotify.com/authorize");
auth.search = new URLSearchParams({ client_id: id, response_type: "code", redirect_uri: redirect, scope: "user-top-read", state }).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", redirect);
  if (url.pathname !== "/callback") return res.writeHead(404).end();
  if (url.searchParams.get("state") !== state) return res.writeHead(400).end("State mismatch.");
  const code = url.searchParams.get("code");
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code: code ?? "", redirect_uri: redirect }),
  });
  const body = await tokenRes.json();
  if (!body.refresh_token) {
    res.writeHead(500).end("Token exchange failed. Check the terminal.");
    console.error(body);
  } else {
    res.writeHead(200, { "Content-Type": "text/plain" }).end("Done! You can close this tab.");
    console.log(`\nSPOTIFY_REFRESH_TOKEN=${body.refresh_token}\n`);
  }
  server.close();
});

server.listen(8888, "127.0.0.1", () => console.log(`Open this URL to authorize:\n\n${auth}\n`));
