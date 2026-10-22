export interface Env {
	ASSETS: Fetcher;
	DB: D1Database;
	/** Base64 of 32 random bytes; encrypts Moodle tokens and webhook URLs at rest. */
	TOKEN_KEY: string;
	/** Base64url of the uncompressed P-256 public key (65 bytes), handed to browsers for Web Push. */
	VAPID_PUBLIC_KEY: string;
	/** Base64url of the P-256 private scalar (32 bytes). */
	VAPID_PRIVATE_KEY: string;
	/** `mailto:` or `https:` contact that push services may use to reach the operator. */
	VAPID_SUBJECT: string;
	/** Local only (.dev.vars): the Vite dev server's origin, whose /api proxy forwards its own Origin header. */
	DEV_ORIGIN?: string;
}
