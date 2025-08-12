/// <reference types="vitest" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from './middleware';

// ---------------- Mock astro:actions ----------------
const mockGetActionContext = {
	setActionResult: vi.fn<(name: string, result: unknown) => void>(),
	serializeActionResult: vi.fn(<T>(result: T) => result),
};

// Return the action from context.locals.action so tests can inject it
vi.mock('astro:actions', () => ({
	getActionContext: (ctx: { locals?: { action?: unknown } }) => ({
		action: ctx.locals?.action,
		setActionResult: mockGetActionContext.setActionResult,
		serializeActionResult: mockGetActionContext.serializeActionResult,
	}),
}));

// ---------------- Test helpers ----------------
type CreateCtxOpts = {
	url?: string;
	method?: string;
	headers?: Record<string, string>;
	isPrerendered?: boolean;
	cookies?: [string, { value: unknown }][];
	action?: {
		calledFrom?: 'form' | string;
		name?: string;
		handler?: () => Promise<unknown>;
	};
};

const createMockContext = (options: CreateCtxOpts = {}) => {
	const cookiesStore = new Map<string, { value: unknown }>(options.cookies ?? []);

	return {
		isPrerendered: options.isPrerendered ?? false,
		url: new URL(options.url ?? 'https://example.com/'),
		request: new Request(options.url ?? 'https://example.com/', {
			method: options.method ?? 'POST',
			headers: new Headers(options.headers ?? {}),
		}),
		// cookie API with .get/.set/.delete and a .json() reader
		cookies: {
			get: vi.fn((key: string) => {
				const found = cookiesStore.get(key);
				if (!found) return undefined;
				const raw = typeof found.value === 'string' ? found.value : JSON.stringify(found.value);
				return {
					value: raw,
					json: async () =>
						typeof found.value === 'string' ? JSON.parse(found.value) : found.value,
				};
			}),
			set: vi.fn((key: string, value: unknown, opts?: unknown) => {
				cookiesStore.set(key, { value });
				return { key, value, opts };
			}),
			delete: vi.fn((key: string) => {
				cookiesStore.delete(key);
			}),
		},
		redirect: vi.fn(
			(to: string, status = 303) => new Response(null, { status, headers: { Location: to } }),
		),
		locals: { action: options.action },
	};
};

const mockNext = vi.fn(async () => new Response('ok-next'));

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------- Tests ----------------
describe('Middleware Security & Hardening', () => {
	describe('General Handling', () => {
		it('calls next() for prerendered pages (adds headers)', async () => {
			const context = createMockContext({ isPrerendered: true, method: 'GET' });
			const res = (await onRequest(context as any, mockNext)) as Response;
			expect(mockNext).toHaveBeenCalledOnce();
			expect(res.headers.get('X-Frame-Options')).toBe('DENY');
		});

		it('calls next() when there is no action and no cookie', async () => {
			const context = createMockContext({ method: 'GET' });
			await onRequest(context as any, mockNext);
			expect(mockNext).toHaveBeenCalledOnce();
			expect(mockGetActionContext.setActionResult).not.toHaveBeenCalled();
			expect(context.cookies.set).not.toHaveBeenCalled();
		});
	});

	describe('Cookie ingestion', () => {
		it('processes a valid ACTION_PAYLOAD cookie then deletes it', async () => {
			const payload = { actionName: 'testAction', actionResult: { success: true } };
			const context = createMockContext({
				method: 'GET',
				cookies: [['ACTION_PAYLOAD', { value: JSON.stringify(payload) }]],
			});

			await onRequest(context as any, mockNext);

			expect(mockGetActionContext.setActionResult).toHaveBeenCalledWith('testAction', {
				success: true,
			});
			expect(context.cookies.delete).toHaveBeenCalledWith('ACTION_PAYLOAD', { path: '/' });
			expect(mockNext).toHaveBeenCalledOnce();
		});

		it('ignores & deletes an oversized cookie', async () => {
			const large = { actionName: 'x', actionResult: 'a'.repeat(4000) };
			const context = createMockContext({
				method: 'GET',
				cookies: [['ACTION_PAYLOAD', { value: JSON.stringify(large) }]],
			});

			await onRequest(context as any, mockNext);

			expect(mockGetActionContext.setActionResult).not.toHaveBeenCalled();
			expect(context.cookies.delete).toHaveBeenCalledWith('ACTION_PAYLOAD', { path: '/' });
			expect(mockNext).toHaveBeenCalledOnce();
		});

		it('ignores & deletes malformed JSON', async () => {
			const context = createMockContext({
				method: 'GET',
				cookies: [['ACTION_PAYLOAD', { value: '{ "bad": true, }' }]],
			});

			await onRequest(context as any, mockNext);

			expect(mockGetActionContext.setActionResult).not.toHaveBeenCalled();
			expect(context.cookies.delete).toHaveBeenCalledWith('ACTION_PAYLOAD', { path: '/' });
			expect(mockNext).toHaveBeenCalledOnce();
		});

		it('ignores cookie with invalid actionName shape', async () => {
			const payload = { actionName: 123, actionResult: 'oops' };
			const context = createMockContext({
				method: 'GET',
				cookies: [['ACTION_PAYLOAD', { value: JSON.stringify(payload) }]],
			});

			await onRequest(context as any, mockNext);

			expect(mockGetActionContext.setActionResult).not.toHaveBeenCalled();
			expect(context.cookies.delete).toHaveBeenCalledWith('ACTION_PAYLOAD', { path: '/' });
		});
	});

	describe('Form actions (PRG 303)', () => {
		it('sets cookie and redirects to current path on success (303)', async () => {
			const action = {
				calledFrom: 'form' as const,
				name: 'newsletter',
				handler: vi.fn().mockResolvedValue({ success: true }),
			};
			const context = createMockContext({ action, url: 'https://example.com/newsletter' });

			const res = (await onRequest(context as any, mockNext)) as Response;

			expect(context.cookies.set).toHaveBeenCalled();
			expect(context.redirect).toHaveBeenCalledWith('/newsletter', 303);
			expect(res.status).toBe(303);
			expect(mockNext).not.toHaveBeenCalled();
		});

		it('prevents open redirect on error (cross-origin referer)', async () => {
			const action = {
				calledFrom: 'form' as const,
				handler: vi.fn().mockResolvedValue({ error: 'Failed' }),
			};
			const context = createMockContext({
				action,
				headers: { referer: 'https://evil-phishing-site.com/login' },
			});

			const res = (await onRequest(context as any, mockNext)) as Response;

			expect(context.redirect).toHaveBeenCalledWith('/', 303);
			expect(res.headers.get('Location')).toBe('/');
		});

		it('does NOT set cookie if result is oversized', async () => {
			const huge = { error: 'a'.repeat(4000) };
			const action = {
				calledFrom: 'form' as const,
				name: 'bigAction',
				handler: vi.fn().mockResolvedValue(huge),
			};
			const context = createMockContext({ action });

			const res = (await onRequest(context as any, mockNext)) as Response;

			expect(context.cookies.set).not.toHaveBeenCalled();
			expect(context.redirect).toHaveBeenCalled(); // still redirects
			expect(res.status).toBe(303);
		});

		it('redirects to safe same-origin referer on error', async () => {
			const action = {
				calledFrom: 'form' as const,
				handler: vi.fn().mockResolvedValue({ error: 'Failed' }),
			};
			const context = createMockContext({
				action,
				url: 'https://example.com/contact',
				headers: { referer: 'https://example.com/contact?failed=true' },
			});

			const res = (await onRequest(context as any, mockNext)) as Response;

			expect(context.redirect).toHaveBeenCalledWith('/contact?failed=true', 303);
			expect(res.headers.get('Location')).toBe('/contact?failed=true');
		});
	});
});
