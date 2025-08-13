import type { Settings } from '@utils/keystatic/types';
import type { ContentEntry } from 'types';

export function filterPosts(entry: ContentEntry, site: Settings) {
	const margin = site?.scheduledPostMargin ?? 0;

	const isPublishTimePassed =
		Date.now() > new Date(entry.data.pubDatetime).getTime() - margin * 60_000;

	return !entry.data.draft && (import.meta.env.DEV || isPublishTimePassed);
}
