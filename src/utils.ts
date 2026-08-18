export function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

// Content is organized in language subdirectories: posts/en/*, posts/zh/*.
// The collection entry id keeps the directory prefix (e.g. "en/my-post").
export function slugOf(id: string): string {
	return id.replace(/^(en|zh)\//, '');
}
