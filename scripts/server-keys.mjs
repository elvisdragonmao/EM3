// Prints fresh secrets for the EM3 server in .dev.vars format.
// Local: node scripts/server-keys.mjs > .dev.vars
// Production: run it once and `wrangler secret put` each value; keep them, since a new
// TOKEN_KEY makes stored tokens unreadable and a new VAPID key drops every push subscription.
import { webcrypto as crypto } from "node:crypto";

const b64url = bytes => Buffer.from(bytes).toString("base64url");
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
const { d } = await crypto.subtle.exportKey("jwk", pair.privateKey);

console.log(`TOKEN_KEY=${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64")}`);
console.log(`VAPID_PUBLIC_KEY=${b64url(pub)}`);
console.log(`VAPID_PRIVATE_KEY=${d}`);
console.log(`VAPID_SUBJECT=https://e3.emtech.cc`);
// Local only; leave it out in production.
console.log(`DEV_ORIGIN=http://localhost:5173`);
