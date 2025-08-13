import { getEntries } from 'astro:content';
import rss from '@astrojs/rss';
import { posts, site } from '@utils/posts';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
	if (!context.site) {
		throw new Error('The "site" property is not set in astro.config.mjs.');
	}

	const response = await rss({
		title: site.title,
		description: site.description,
		site: context.site,
		items: await Promise.all(
			posts.map(async ({ data, id, collection }) => {
				const resolvedTags = data.tags ? await getEntries(data.tags) : [];
				const tagNames = resolvedTags.map((tag) => tag.data.name);

				return {
					title: data.title,
					link: `/${collection}/${id}/`,
					pubDate: new Date(data.modDatetime ?? data.pubDatetime),
					description: data.description,
					enclosure: {
						url: new URL(`/${collection}/${id}.webp`, context.site).href,
						type: 'image/webp',
						length: 1,
					},
					...(tagNames.length > 0 && { categories: tagNames }),
					author: data.author ?? site.author,
				};
			}),
		),
	});

	// Cache at the edge for 1 hour; allow 7 days stale-while-revalidate
	response.headers.set(
		'Cache-Control',
		'public, max-age=0, s-maxage=3600, stale-while-revalidate=604800',
	);

	return response;
}
