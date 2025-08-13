import type { ContentEntry } from 'types';

export function getFeatured<T extends ContentEntry>(entries: readonly T[], limit = 3): T[] {
	const featured = entries
		.filter((entry) => entry.data.featured.discriminant)
		.map((entry) => ({ entry, position: Number(entry.data.featured.value) }));

	const entriesByPosition = featured.reduce((map, { entry, position }) => {
		const list = map.get(position) ?? [];
		list.push(entry);
		map.set(position, list);
		return map;
	}, new Map<number, T[]>());

	const duplicateMessages: string[] = [];
	for (const [position, grouped] of entriesByPosition) {
		if (grouped.length > 1) {
			const identifiers = grouped.map((e) => e.id ?? e.data?.title ?? '(unknown)').join(', ');
			duplicateMessages.push(`position ${position}: [${identifiers}]`);
		}
	}
	if (duplicateMessages.length) {
		throw new Error(`Duplicate featured positions:\n${duplicateMessages.join('\n')}`);
	}

	return featured
		.sort((a, b) => a.position - b.position)
		.slice(0, limit)
		.map((x) => x.entry);
}
