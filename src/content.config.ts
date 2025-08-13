import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const featuredSchema = z.discriminatedUnion('discriminant', [
	z.object({
		discriminant: z.literal(true),
		value: z.enum(['1', '2', '3']),
	}),
	z.object({
		discriminant: z.literal(false),
		value: z.undefined().transform(() => undefined),
	}),
]);

const baseSchema = z.object({
	draft: z.boolean().default(false),
	featured: featuredSchema,
	author: z.string(),
	title: z.string().min(1, { message: 'Title cannot be empty.' }),
	description: z.string().min(1, { message: 'Description cannot be empty.' }),
	pubDatetime: z.coerce.date(),
	modDatetime: z.coerce.date().optional(),
	copyright: reference('licenses'),
	series: reference('series').optional(),
	tags: z.array(reference('tags')).default([]),
	image: z.object({
		src: z.string().url(),
		alt: z.string().min(1, { message: 'Image alt text cannot be empty.' }),
	}),
});

const blog = defineCollection({
	loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/blog' }),
	schema: baseSchema.extend({
		canonicalURL: z.string().url().optional(),
	}),
});

const projects = defineCollection({
	loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/projects' }),
	schema: baseSchema.extend({
		repoUrl: z.string().url().optional(),
		demoUrl: z.string().url().optional(),
		status: z.enum(['completed', 'in-progress', 'planned']).default('completed'),
	}),
});

const artworks = defineCollection({
	loader: glob({ pattern: '**/[^_]*.json', base: './src/content/artworks' }),
	schema: z.object({
		draft: z.boolean().default(false),
		featured: featuredSchema,
		author: z.string(),
		title: z.string().min(1, { message: 'Album Title cannot be empty.' }),
		description: z.string().min(1, { message: 'Album Description cannot be empty.' }),
		pubDatetime: z.coerce.date(),
		modDatetime: z.coerce.date().optional(),
		projects: z.array(
			z.object({
				title: z.string(),
				images: z.array(
					z.object({
						title: z.string().optional(),
						pubDatetime: z.coerce.date(),
						modDatetime: z.coerce.date().optional(),
						src: z.string().url(),
						alt: z.string(),
						link: z.string().url().optional(),
					}),
				),
			}),
		),
	}),
});

const tags = defineCollection({
	loader: glob({ pattern: '**/[^_]*.json', base: './src/content/tags' }),
	schema: z.object({
		name: z.string().min(1, { message: 'Tag Name cannot be empty.' }),
	}),
});

const series = defineCollection({
	loader: glob({ pattern: '**/[^_]*.json', base: './src/content/series' }),
	schema: z.object({
		name: z.string().min(1, { message: 'Series Name cannot be empty.' }),
	}),
});

const licenses = defineCollection({
	loader: glob({ pattern: '**/[^_]*.json', base: './src/content/licenses' }),
	schema: z.object({
		name: z.string().min(1, { message: 'License Name cannot be empty.' }),
		description: z.string().optional(),
		url: z.string().url(),
		type: z.enum(['blog', 'project']),
	}),
});

const settings = defineCollection({
	loader: glob({ pattern: '**/[^_]*.json', base: './src/content/settings' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		author: z.string(),
		defaultImageAlt: z.string(),
		scheduledPostMargin: z.number().int().default(0),
		twitterCard: z.enum(['summary_large_image', 'summary', 'app', 'player']),
		socials: z.array(
			z.object({
				icon: z.string(),
				label: z.string(),
				url: z.string().url(),
				handle: z.string(),
			}),
		),
	}),
});

const navigation = defineCollection({
	loader: glob({ pattern: '**/[^_]*.json', base: './src/content/navigation' }),
	schema: z.object({
		header: z.array(
			z.object({
				name: z.string(),
				url: z.string(),
			}),
		),
		footer: z.array(
			z.object({
				title: z.string(),
				links: z.array(
					z.object({
						name: z.string(),
						url: z.string(),
					}),
				),
			}),
		),
	}),
});

export const collections = {
	blog,
	projects,
	artworks,
	tags,
	series,
	licenses,
	settings,
	navigation,
};
