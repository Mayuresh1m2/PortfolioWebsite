import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE_DESCRIPTION } from '../consts';

export const GET: APIRoute = async ({ site }) => {
	const base = site?.toString().replace(/\/$/, '') ?? '';
	const posts = (await getCollection('blog')).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
	);

	const postLines = posts
		.map((post) => `- [${post.data.title}](${base}/blog/${post.id}/): ${post.data.description}`)
		.join('\n');

	const body = `# Mayuresh

> ${SITE_DESCRIPTION}

## About

- [About Me](${base}/): Background, career across Samsung, Amazon, and Maersk, and interests in distributed systems, platform engineering, AI/ML platforms, and music.

## Blog

${postLines || '- No posts yet.'}
`;

	return new Response(body, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
