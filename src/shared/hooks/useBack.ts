import { type NavigateOptions, useRouter } from "@tanstack/react-router";

/** A page opened directly has no earlier app entry to go back to. */
export function useBack(fallback: NavigateOptions) {
	const router = useRouter();
	return () => {
		if (router.history.canGoBack()) router.history.back();
		else void router.navigate({ ...fallback, replace: true });
	};
}
