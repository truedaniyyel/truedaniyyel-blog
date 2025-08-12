import { expect, test } from 'vitest';
import { escapeHtml } from '.';

test('escapeHtml should escape critical HTML characters', () => {
	const input = `<script>"I'm a hacker' & proud"</script>`;
	const expectedOutput =
		'&lt;script&gt;&quot;I&#39;m a hacker&#39; &amp; proud&quot;&lt;/script&gt;';

	expect(escapeHtml(input)).toBe(expectedOutput);
});

test('escapeHtml should handle strings with no special characters', () => {
	const input = 'This is a safe string.';
	expect(escapeHtml(input)).toBe(input);
});
