# Mayuresh — Personal Site

Personal site and blog, built with [Astro](https://astro.build).

## Project Structure

```text
/
├── public/                  # static assets (favicon, etc.)
├── src/
│   ├── content/
│   │   └── blog/            # blog posts (Markdown)
│   ├── content.config.ts    # blog collection schema
│   ├── consts.ts             # site title/description, social links
│   ├── layouts/
│   │   └── Layout.astro     # shared page shell (nav + footer)
│   ├── styles/
│   │   └── global.css
│   └── pages/
│       ├── index.astro      # About Me (home page)
│       └── blog/
│           ├── index.astro  # blog listing
│           └── [id].astro   # individual post page
└── package.json
```

## Adding a blog post

Create a new Markdown file in `src/content/blog/`, e.g. `src/content/blog/my-post.md`:

```markdown
---
title: "My Post Title"
description: "One or two sentence summary."
pubDate: 2026-10-06
tags: ["platform-engineering"]
---

Post content goes here.
```

It'll automatically show up on `/blog`, sorted by `pubDate`, at `/blog/my-post/`.

## Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |

Deployed via Cloudflare Workers (see `wrangler.jsonc`).
