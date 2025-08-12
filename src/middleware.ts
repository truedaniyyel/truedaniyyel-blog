import { getActionContext } from 'astro:actions';
import { defineMiddleware } from 'astro:middleware';

const MAX_COOKIE_BYTES = 3800; // a bit under typical 4KB limit

function ensureSecurityHeaders(res: Response): Response {
	const h = new Headers(res.headers);

	if (!h.has('X-Frame-Options')) h.set('X-Frame-Options', 'DENY');
	if (!h.has('X-Content-Type-Options')) h.set('X-Content-Type-Options', 'nosniff');
	if (!h.has('X-XSS-Protection')) h.set('X-XSS-Protection', '0');
	if (!h.has('Referrer-Policy')) h.set('Referrer-Policy', 'no-referrer');
	if (!h.has('Strict-Transport-Security')) {
		h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	}
	// Permissions-Policy is long & site-specific; only set a minimal fallback if absent.
	if (!h.has('Permissions-Policy')) {
		h.set('Permissions-Policy', 'geolocation=()');
	}

	return new Response(res.body, { status: res.status, headers: h });
}

export const onRequest = defineMiddleware(async (context, next) => {
	// prerendered pages: just pass through and add headers
	if (context.isPrerendered) {
		const res = await next();
		return ensureSecurityHeaders(res);
	}

	const { action, setActionResult, serializeActionResult } = getActionContext(context);

	// ---- Ingest cookie safely
	const payloadCookie = context.cookies.get('ACTION_PAYLOAD');
	if (payloadCookie) {
		try {
			const raw = payloadCookie.value ?? '';
			if (raw && new TextEncoder().encode(raw).length <= MAX_COOKIE_BYTES) {
				const { actionName, actionResult } = await payloadCookie.json();

				// basic shape check
				if (typeof actionName === 'string' && actionName.length <= 100) {
					setActionResult(actionName, actionResult);
				}
			}
		} catch {
			// swallow parse errors
		} finally {
			// always delete on read to avoid replay
			context.cookies.delete('ACTION_PAYLOAD', { path: '/' });
		}

		const res = await next();
		return ensureSecurityHeaders(res);
	}

	// ---- Handle form actions
	if (action?.calledFrom === 'form') {
		const actionResult = await action.handler();

		const cookiePayload = {
			actionName: action.name,
			actionResult: serializeActionResult(actionResult),
		};

		// store small payload; otherwise consider server state instead of cookie
		const encoded = new TextEncoder().encode(JSON.stringify(cookiePayload));
		if (encoded.length <= MAX_COOKIE_BYTES) {
			context.cookies.set('ACTION_PAYLOAD', cookiePayload, {
				httpOnly: true,
				secure: context.url.protocol === 'https:',
				sameSite: 'strict',
				path: '/',
				maxAge: 15, // seconds
			});
		}

		// error -> back to safe referer (same-origin) or '/'
		if ((actionResult as any)?.error) {
			const referer = context.request.headers.get('referer');
			let redirectUrl = '/';
			if (referer) {
				try {
					const refererUrl = new URL(referer);
					if (refererUrl.origin === context.url.origin) {
						redirectUrl = refererUrl.pathname + refererUrl.search + refererUrl.hash;
					}
				} catch {
					// ignore bad referer
				}
			}
			// use 303 for PRG
			return context.redirect(redirectUrl, 303);
		}

		// success -> redirect to current path (PRG)
		return context.redirect(context.url.pathname, 303);
	}

	const res = await next();
	return ensureSecurityHeaders(res);
});
