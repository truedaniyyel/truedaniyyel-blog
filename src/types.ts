import type { CollectionEntry } from 'astro:content';

export type ContentEntry =
	| CollectionEntry<'blog'>
	| CollectionEntry<'projects'>
	| CollectionEntry<'artworks'>;

export type ContentCollections = 'blog' | 'projects' | 'artworks';

export interface PostMeta {
	plainText: string;
	readingTimeText: string;
}

export type WithMeta<T> = Omit<T, 'meta'> & { meta: PostMeta };
