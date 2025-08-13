import { getCollection } from 'astro:content';
import { reader } from '@utils/keystatic';
import { getFeatured } from './featured';
import { filterPosts } from './filter';
import { attachMeta } from './meta';
import { sortByDate } from './sort';

async function required<T>(p: Promise<T | null>, name: string): Promise<T> {
	const v = await p;
	if (v == null) throw new Error(`Missing ${name}`);
	return v;
}

export const [site, navigation] = await Promise.all([
	required(reader.singletons.settings.read(), 'settings'),
	required(reader.singletons.navigation.read(), 'navigation'),
]);

const [blogPosts, projectPosts, artworkPosts] = await Promise.all([
	getCollection('blog', (entry) => filterPosts(entry, site)),
	getCollection('projects', (entry) => filterPosts(entry, site)),
	getCollection('artworks', (entry) => filterPosts(entry, site)),
]);

export const blog = sortByDate(blogPosts).map(attachMeta);
export const projects = sortByDate(projectPosts).map(attachMeta);
export const artworks = sortByDate(artworkPosts);
export const posts = sortByDate([...blog, ...projects]);

export const featured = getFeatured(posts, 3);
