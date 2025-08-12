import type { APIRoute } from 'astro';

const getRobotsTxt = (sitemapURL: URL) => `
User-agent: *
Allow: /

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
	const sitemapURL = new URL('sitemap-index.xml', site);
	const body = getRobotsTxt(sitemapURL);

	return new Response(body, {
		status: 200,
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			// Cache at edge for 1 day; 7 days stale-while-revalidate
			'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
		},
	});
};
