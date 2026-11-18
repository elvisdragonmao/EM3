/** Lets a remote file download without navigating away from the app. */
export function downloadUrl(url: string) {
	const a = document.createElement("a");
	a.href = url;
	a.target = "_blank";
	a.rel = "noreferrer";
	a.click();
}

/** Hands a generated file to the browser's download flow. */
export function saveBlob(blob: Blob, name: string) {
	const a = document.createElement("a");
	a.href = URL.createObjectURL(blob);
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Strips characters that Windows and macOS reject in file and folder names. */
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "_").trim();
