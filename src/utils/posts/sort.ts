import type { ContentEntry } from 'types';

export function sortByDate<T extends ContentEntry>(collection: T[]): T[] {
	return [...collection].sort(
		(a, b) =>
			new Date(b.data.modDatetime ?? b.data.pubDatetime).getTime() -
			new Date(a.data.modDatetime ?? a.data.pubDatetime).getTime(),
	);
}
