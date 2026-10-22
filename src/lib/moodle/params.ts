// Moodle's form encoding, with no imports, so the EM3 Worker can share it with the app.

export type Scalar = string | number | boolean;
export type WsValue = Scalar | WsValue[] | { [key: string]: WsValue | undefined };
export type WsParams = { [key: string]: WsValue | undefined };

/** Flattens nested params into Moodle's PHP-style `a[0][b]=c` form encoding. */
export function encodeParams(params: WsParams, body = new URLSearchParams(), prefix = ""): URLSearchParams {
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined) continue;
		const name = prefix ? `${prefix}[${key}]` : key;
		if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
			encodeParams(value as WsParams, body, name);
		} else {
			body.append(name, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
		}
	}
	return body;
}
