import { getPlainTextFromMarkdown } from '@utils/plainTextFromMarkdown';
import { getReadingTime } from '@utils/readingTime';
import type { WithMeta } from 'types';

export function attachMeta<T extends { body?: string }>(post: T): WithMeta<T> {
	const plainText = post.body ? getPlainTextFromMarkdown(post.body) : '';
	const readingTime = post.body ? getReadingTime(post.body, plainText) : undefined;

	return {
		...post,
		meta: {
			plainText,
			readingTimeText: readingTime?.text ?? '',
		},
	};
}
