// src/actions/index.ts
import { defineAction } from 'astro:actions';
import { escapeHtml } from '@utils/escapeHtml';
import { z } from 'astro/zod';
import { Resend } from 'resend';

// ----- env helper (reads at call time; works in tests & prod) -----
function env(key: string): string | undefined {
	const v = (import.meta as any).env?.[key];
	return v ?? (process.env as any)?.[key];
}

// ----- fetch with timeout to avoid hanging external calls -----
async function fetchWithTimeout(
	input: RequestInfo | URL,
	init: RequestInit = {},
	ms = 8000,
): Promise<Response> {
	const ctrl = new AbortController();
	const id = setTimeout(() => ctrl.abort(), ms);
	try {
		return await fetch(input, { ...init, signal: ctrl.signal });
	} finally {
		clearTimeout(id);
	}
}

// ----- optional Reply-To allowlist (empty => allow all valid emails) -----
const REPLYTO_DOMAIN_ALLOWLIST = new Set<string>([
	// 'gmail.com', 'proton.me', 'yourdomain.com'
]);
function safeReplyTo(email: string): string | undefined {
	const match = email.toLowerCase().match(/^[^@\s]+@([^@\s]+)$/);
	if (!match) return undefined;
	const domain = match[1];
	if (REPLYTO_DOMAIN_ALLOWLIST.size && !REPLYTO_DOMAIN_ALLOWLIST.has(domain)) return undefined;
	return email;
}

// ----- Turnstile verification -----
async function verifyTurnstile(token: string): Promise<boolean> {
	const secret = env('TURNSTILE_SECRET_KEY');
	if (!secret) return true; // skip in local/tests if not configured
	if (!token) return false;

	const body = new URLSearchParams({ secret, response: token });

	try {
		const resp = await fetchWithTimeout(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			{ method: 'POST', body },
			5000,
		);
		const data = (await resp.json()) as { success?: boolean };
		return !!data.success;
	} catch {
		// timeout / network error
		return false;
	}
}

// ----- Resend lazy init -----
let resendClient: Resend | null = null;
function getResend() {
	if (!resendClient) {
		const key = env('RESEND_API_KEY');
		if (!key) throw new Error('RESEND_API_KEY is not defined');
		resendClient = new Resend(key);
	}
	return resendClient;
}

// ----- Schemas -----
const noNewlines = z.string().refine((v) => !/[\r\n]/.test(v), { message: 'Invalid characters.' });

export const tokenSchema = z.object({
	'cf-turnstile-response': z.string().optional(),
});
const getToken = (data: { 'cf-turnstile-response'?: string }) =>
	data['cf-turnstile-response'] ?? '';

export const contactInputSchema = z
	.object({
		name: z.string().trim().min(1).max(100).pipe(noNewlines),
		email: z.string().trim().email().pipe(noNewlines),
		message: z.string().trim().min(1).max(5000),
	})
	.and(tokenSchema);
export type ContactInput = z.infer<typeof contactInputSchema>;

export const newsletterInputSchema = z
	.object({
		email: z.string().trim().email().pipe(noNewlines),
	})
	.and(tokenSchema);
export type NewsletterInput = z.infer<typeof newsletterInputSchema>;

type ActionResult = { success: true; message?: string } | { success: false; error: string };

// ----- Pure handlers -----
export async function contactHandler(data: ContactInput): Promise<ActionResult> {
	const token = getToken(data);
	const human = await verifyTurnstile(token);
	if (!human) return { success: false, error: 'Verification failed. Please try again.' };

	try {
		const safeName = escapeHtml(data.name);
		const safeEmail = escapeHtml(data.email);
		const safeMessage = escapeHtml(data.message).replace(/\n/g, '<br>');

		const resend = getResend();
		const replyTo = safeReplyTo(safeEmail);

		const { error } = await resend.emails.send({
			from: 'Contact Form <contact@mail.truedaniyyel.com>',
			to: 'truedaniyyel@gmail.com',
			subject: `New Contact Form Submission from ${safeName}`,
			...(replyTo && { replyTo }),
			html: `
        <p>You have a new contact form submission:</p>
        <p><strong>Name:</strong> ${safeName}</p>
        <p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
        <p><strong>Message:</strong></p>
        <p>${safeMessage}</p>
      `,
		});

		if (error) {
			console.error({ error });
			return { success: false, error: 'Email could not be sent.' };
		}
		return { success: true, message: 'Your message has been sent!' };
	} catch (e) {
		console.error(e);
		return { success: false, error: 'An unexpected error occurred.' };
	}
}

export async function newsletterHandler(data: NewsletterInput): Promise<ActionResult> {
	const token = getToken(data);
	const human = await verifyTurnstile(token);
	if (!human) return { success: false, error: 'Verification failed. Please try again.' };

	try {
		const kitKey = env('KIT_API_KEY');
		const formId = env('KIT_FORM_ID');

		if (!kitKey || !formId) {
			console.error('KIT env missing');
			return { success: false, error: 'Subscription service is not configured.' };
		}

		// 1) Create subscriber
		const createResp = await fetchWithTimeout(
			'https://api.kit.com/v4/subscribers',
			{
				method: 'POST',
				headers: {
					'X-Kit-Api-Key': kitKey,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email_address: data.email }),
			},
			8000,
		);
		if (!createResp.ok) {
			const errorData = await createResp.json().catch(() => ({}));
			console.error('Kit API (Create Subscriber) Error:', errorData);
			const errs = (errorData as { errors?: unknown }).errors;
			const message =
				Array.isArray(errs) && typeof errs[0] === 'string'
					? escapeHtml(errs[0])
					: 'Could not subscribe. Please try again.';
			return { success: false, error: message };
		}

		// 2) Add to form/list
		const addResp = await fetchWithTimeout(
			`https://api.kit.com/v4/forms/${formId}/subscribers`,
			{
				method: 'POST',
				headers: {
					'X-Kit-Api-Key': kitKey,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email_address: data.email }),
			},
			8000,
		);
		if (!addResp.ok) {
			const errorData = await addResp.json().catch(() => ({}));
			console.error('Kit API (Add to Form) Error:', errorData);
			return {
				success: false,
				error:
					"You've been subscribed, but we couldn't add you to the list. Please contact support.",
			};
		}

		return {
			success: true,
			message: "You're in! Check your email to confirm your subscription.",
		};
	} catch (e) {
		console.error(e);
		return { success: false, error: 'An unexpected error occurred.' };
	}
}

// ----- Wire up Actions -----
export const server = {
	contact: defineAction({
		accept: 'form',
		input: contactInputSchema,
		handler: contactHandler,
	}),
	newsletterSubscribe: defineAction({
		accept: 'form',
		input: newsletterInputSchema,
		handler: newsletterHandler,
	}),
};
