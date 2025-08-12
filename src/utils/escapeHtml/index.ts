const escapeMap: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

export function escapeHtml(str: string): string {
	return str.replace(/[&<>"']/g, (char) => escapeMap[char] ?? char);
}
