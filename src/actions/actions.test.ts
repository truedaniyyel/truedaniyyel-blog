import { escapeHtml } from '@utils/escapeHtml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- mock Resend FIRST (before importing the module under test) ---
const sendSpy = vi.fn().mockResolvedValue({ data: { id: 'ok' }, error: null });
vi.mock('resend', () => ({
	Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendSpy } })),
}));

// now import handlers & schemas
import {
	contactHandler,
	contactInputSchema,
	newsletterHandler,
	newsletterInputSchema,
} from '../actions';

const originalFetch = globalThis.fetch;

beforeEach(() => {
	vi.clearAllMocks(); // keep implementations; reset call history
	sendSpy.mockResolvedValue({ data: { id: 'ok' }, error: null });

	// clean env; we’ll set only what each test needs
	delete process.env.RESEND_API_KEY;
	delete process.env.KIT_API_KEY;
	delete process.env.KIT_FORM_ID;
	delete process.env.TURNSTILE_SECRET_KEY;

	globalThis.fetch = originalFetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe('contact handler', () => {
	it('escapes HTML and accepts clean input', async () => {
		process.env.RESEND_API_KEY = 'resend-key';
		process.env.TURNSTILE_SECRET_KEY = 'secret';

		// Turnstile verify -> success
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ success: true }), { status: 200 }),
			) as any;

		const valid = {
			name: '<b>Alice</b>',
			email: 'alice@example.com',
			message: 'Hello <script>alert(1)</script>\nNext line',
			'cf-turnstile-response': 'dummy',
		};

		const parsed = await contactInputSchema.safeParseAsync(valid);
		expect(parsed.success).toBe(true);

		const result = await contactHandler(valid as any);
		expect(result).toMatchObject({ success: true });
		expect(sendSpy).toHaveBeenCalledTimes(1);

		expect(escapeHtml('<b>')).toBe('&lt;b&gt;');
	});

	it('rejects newline in email (validation error via schema)', async () => {
		const bad = await contactInputSchema.safeParseAsync({
			name: 'Alice',
			email: 'bad@example.com\r\nBCC:evil@haxx.tld',
			message: 'hi',
			'cf-turnstile-response': 'dummy',
		});
		expect(bad.success).toBe(false);
	});

	it('enforces max length on name', async () => {
		const bad = await contactInputSchema.safeParseAsync({
			name: 'A'.repeat(101),
			email: 'a@a.com',
			message: 'ok',
			'cf-turnstile-response': 'dummy',
		});
		expect(bad.success).toBe(false);
	});

	// NEW: Turnstile fail path for contact
	it('fails when Turnstile verification fails', async () => {
		process.env.RESEND_API_KEY = 'resend-key';
		process.env.TURNSTILE_SECRET_KEY = 'secret';

		// Turnstile verify -> failure
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ success: false }), { status: 200 }),
			) as any;

		const input = {
			name: 'Bob',
			email: 'bob@example.com',
			message: 'Hi',
			'cf-turnstile-response': 'dummy',
		};

		const result = await contactHandler(input as any);
		expect(result).toEqual({ success: false, error: 'Verification failed. Please try again.' });
		expect(sendSpy).not.toHaveBeenCalled();
	});

	// NEW: assert subject + replyTo shape
	it('sends email with expected subject and replyTo', async () => {
		process.env.RESEND_API_KEY = 'resend-key';
		process.env.TURNSTILE_SECRET_KEY = 'secret';

		// Turnstile verify -> success
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ success: true }), { status: 200 }),
			) as any;

		const input = {
			name: 'Alice & Bob',
			email: 'alice@example.com',
			message: 'Hello',
			'cf-turnstile-response': 'dummy',
		};

		const res = await contactHandler(input as any);
		expect(res.success).toBe(true);
		expect(sendSpy).toHaveBeenCalledTimes(1);

		const mail = sendSpy.mock.calls[0][0] as {
			from: string;
			to: string;
			subject: string;
			replyTo: string;
			html: string;
		};

		expect(mail.replyTo).toBe('alice@example.com');
		// subject is built from escapeHtml(name) so & becomes &amp;
		expect(mail.subject).toBe('New Contact Form Submission from Alice &amp; Bob');
	});
});

describe('newsletter handler', () => {
	it('subscribes on happy path', async () => {
		process.env.KIT_API_KEY = 'k';
		process.env.KIT_FORM_ID = 'f';
		process.env.TURNSTILE_SECRET_KEY = 'secret';

		// Mock 3 fetches: Turnstile verify -> Kit create -> Kit add
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 })) // verify
			.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'sub' }), { status: 200 })) // create
			.mockResolvedValueOnce(new Response(null, { status: 200 })) as any; // add

		const input = { email: 'user@example.com', 'cf-turnstile-response': 'dummy' };

		const parsed = await newsletterInputSchema.safeParseAsync(input);
		expect(parsed.success).toBe(true);

		const result = await newsletterHandler(input as any);
		expect(result).toMatchObject({ success: true });
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('handles external API failure safely (no HTML injection in message)', async () => {
		process.env.KIT_API_KEY = 'k';
		process.env.KIT_FORM_ID = 'f';
		process.env.TURNSTILE_SECRET_KEY = 'secret';

		// verify -> ok, create -> 400 with HTML error
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ errors: ['<script>nope</script>'] }), { status: 400 }),
			) as any;

		const input = { email: 'bad@example.com', 'cf-turnstile-response': 'dummy' };
		const result = await newsletterHandler(input as any);
		expect(result.success).toBe(false);

		if ('error' in result) {
			expect(String(result.error)).not.toMatch(/<script>|<\/script>/i);
		} else {
			throw new Error('Expected failure result but got success');
		}
	});

	// NEW: Turnstile fail path for newsletter
	it('fails when Turnstile verification fails', async () => {
		process.env.KIT_API_KEY = 'k';
		process.env.KIT_FORM_ID = 'f';
		process.env.TURNSTILE_SECRET_KEY = 'secret';

		// Turnstile verify -> failure
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ success: false }), { status: 200 }),
			) as any;

		const input = { email: 'user@example.com', 'cf-turnstile-response': 'dummy' };
		const result = await newsletterHandler(input as any);

		expect(result).toEqual({ success: false, error: 'Verification failed. Please try again.' });
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});
