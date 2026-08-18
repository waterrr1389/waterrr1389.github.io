import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '../config';
import { slugOf } from '../utils';

export async function GET(context) {
	const posts = (await getCollection('posts', ({ id }) => id.startsWith('en/'))).sort(
		(a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
	);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: `/posts/${slugOf(post.id)}/`,
		})),
	});
}
