// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// The published address, the repository and the branch live in site.json, the one place to change them.
// The prebuild scripts read the same file (CNAME, examples.json, edit links on generated pages).
const SITE = JSON.parse(readFileSync(new URL('./site.json', import.meta.url), 'utf-8'));

export default defineConfig({
	site: SITE.url,
	integrations: [
		starlight({
			title: 'Oasis-Blueprints',
			description:
				'Engineering and construction sheet sets as HTML and PDF, drawn by an Agent Skill. The model is the drafter, not the engineer.',
			social: [{ icon: 'github', label: 'GitHub', href: SITE.repo }],
			editLink: { baseUrl: `${SITE.repo}/edit/${SITE.branch}/docs-site/` },
			customCss: ['./src/styles/custom.css'],
			components: { Footer: './src/components/Footer.astro' },
			sidebar: [
				{
					label: 'Get started',
					items: [
						{ label: 'What it is', slug: 'get-started/what-it-is' },
						{ label: 'Install (Claude, ChatGPT, Codex, OpenClaw)', slug: 'get-started/install' },
						{ label: 'Your first sheet set', slug: 'get-started/first-sheet-set' },
					],
				},
				{
					label: 'Kits',
					items: [
						{ label: 'Panel schedule kit', slug: 'kits/panel-schedule' },
						{ label: 'Panel schedule design rules', slug: 'kits/panel-schedule-design' },
						{ label: 'Wind C&C kit (S0.0)', slug: 'kits/wind-cc' },
						{ label: 'Sheet video', slug: 'kits/sheet-video' },
						{ label: 'Sheet video: scenes and player', slug: 'kits/sheet-video-player' },
						{ label: 'Sheet video: style and sound', slug: 'kits/sheet-video-style' },
						{ label: 'Sheet video: brief template', slug: 'kits/sheet-video-brief' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ slug: 'guides/site-plan' },
						{ slug: 'guides/deck-set' },
						{ slug: 'guides/company-block' },
						{ slug: 'guides/revise' },
						{ slug: 'guides/print-and-audit' },
						{ slug: 'guides/publish-an-example' },
						{ slug: 'guides/make-a-video' },
					],
				},
				{
					label: 'Concepts',
					items: [
						{ slug: 'concepts/drafter-not-engineer' },
						{ slug: 'concepts/open-items' },
						{ slug: 'concepts/sheet-standard' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ slug: 'reference/project-file' },
						{ slug: 'reference/drawing-api' },
						{ slug: 'reference/detail-library' },
					],
				},
				{ label: 'Examples', items: [{ autogenerate: { directory: 'examples' } }] },
				{
					label: 'Project',
					items: [{ slug: 'project/changelog' }, { slug: 'project/license' }, { slug: 'project/contributing' }],
				},
			],
		}),
	],
});
