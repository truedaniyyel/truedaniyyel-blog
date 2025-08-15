import { collection, config, fields, singleton } from '@keystatic/core';
import { block, mark } from '@keystatic/core/content-components';
import * as React from 'react';

const baseSchema = () => ({
	draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
	featured: fields.conditional(fields.checkbox({ label: 'Featured', defaultValue: false }), {
		true: fields.select({
			label: 'Featured Position (1-3)',
			options: [
				{ label: '1 - Main', value: '1' },
				{ label: '2', value: '2' },
				{ label: '3', value: '3' },
			],
			defaultValue: '1',
		}),
		false: fields.empty(),
	}),
	author: fields.text({ label: 'Author', defaultValue: 'Daniel Adrian' }),
	title: fields.slug({ name: { label: 'Title' } }),
	description: fields.text({
		label: 'Description',
		multiline: true,
		validation: { isRequired: true },
	}),
	pubDatetime: fields.datetime({ label: 'Publish Date', validation: { isRequired: true } }),
	modDatetime: fields.datetime({ label: 'Modified Date' }),
	copyright: fields.relationship({
		label: 'Copyright',
		collection: 'licenses',
		validation: { isRequired: true },
	}),
	series: fields.relationship({
		label: 'Series',
		collection: 'series',
	}),
	tags: fields.array(
		fields.relationship({
			label: 'Tag',
			collection: 'tags',
		}),
		{
			label: 'Tags',
			itemLabel: (props) => props.value ?? 'Select a tag',
		},
	),
	image: fields.object(
		{
			src: fields.url({
				label: 'Cloudinary Image URL',
				description: 'Paste the full URL of the image from your Cloudinary account.',
				validation: { isRequired: true },
			}),
			alt: fields.text({ label: 'Image Alt Text', validation: { isRequired: true } }),
		},
		{ label: 'Image' },
	),
});

export default config({
	storage: {
		kind: 'github',
		repo: 'truedaniyyel/truedaniyyel-blog',
	},

	singletons: {
		settings: singleton({
			label: 'Site Settings',
			path: 'src/content/settings/',
			format: { data: 'json' },
			schema: {
				title: fields.text({ label: 'Site Title', validation: { isRequired: true } }),
				description: fields.text({
					label: 'Site Description',
					multiline: true,
					validation: { isRequired: true },
				}),
				author: fields.text({ label: 'Default Author Name', validation: { isRequired: true } }),
				defaultImageAlt: fields.text({
					label: 'Default OpenGraph Image Alt Text',
					validation: { isRequired: true },
				}),
				scheduledPostMargin: fields.integer({
					label: 'Scheduled Post Margin (minutes)',
					description: 'Number of minutes before a scheduled post is considered visible.',
					validation: { isRequired: true },
					defaultValue: 0,
				}),
				twitterCard: fields.select({
					label: 'Twitter Card Type',
					description: 'Select the default card type for sharing links on Twitter/X.',
					options: [
						{ label: 'Summary with Large Image (Recommended)', value: 'summary_large_image' },
						{ label: 'Summary (Small Image)', value: 'summary' },
						{ label: 'App Card (For mobile apps)', value: 'app' },
						{ label: 'Player Card (For video/audio)', value: 'player' },
					],
					defaultValue: 'summary_large_image',
				}),
				socials: fields.array(
					fields.object({
						icon: fields.text({ label: 'Icon (lucide name)' }),
						label: fields.text({ label: 'Label (e.g., GitHub)' }),
						url: fields.url({ label: 'Profile URL' }),
						handle: fields.text({ label: 'Handle (e.g., @truedaniyyel)' }),
					}),
					{
						label: 'Social Media Links',
						itemLabel: (props) => props.fields.label.value,
					},
				),
			},
		}),

		navigation: singleton({
			label: 'Navigation Menus',
			path: 'src/content/navigation/',
			format: { data: 'json' },
			schema: {
				header: fields.array(
					fields.object({
						name: fields.text({ label: 'Link Text' }),
						url: fields.text({ label: 'URL (e.g., /blog)' }),
					}),
					{
						label: 'Header Navigation Links',
						itemLabel: (props) => props.fields.name.value,
					},
				),
				footer: fields.array(
					fields.object({
						title: fields.text({ label: 'Section Title' }),
						links: fields.array(
							fields.object({
								name: fields.text({ label: 'Link Text' }),
								url: fields.text({ label: 'URL' }),
							}),
							{
								label: 'Links',
								itemLabel: (props) => props.fields.name.value,
							},
						),
					}),
					{
						label: 'Footer Link Sections',
						itemLabel: (props) => props.fields.title.value,
					},
				),
			},
		}),

		about: singleton({
			label: 'About Me',
			path: 'src/content/about/',
			entryLayout: 'content',
			format: {
				contentField: 'content',
			},
			schema: {
				content: fields.mdx({
					label: 'Content',
					components: {
						CldImage: block({
							label: 'Cloudinary Image',
							schema: {
								src: fields.url({ label: 'Image URL', validation: { isRequired: true } }),
								alt: fields.text({ label: 'Alt', validation: { isRequired: true } }),
								width: fields.integer({ label: 'Width', validation: { isRequired: true } }),
								height: fields.integer({ label: 'Height', validation: { isRequired: true } }),
								sizes: fields.text({
									label: 'Sizes',
									defaultValue: '(max-width: 768px) 100vw, 50vw',
								}),
								class: fields.text({ label: 'Class', defaultValue: '' }), // Astro components use `class`
							},
						}),
						Link: mark({
							icon: React.createElement('span', null, '🔗'),
							label: 'Link',
							schema: {
								href: fields.url({ label: 'href', validation: { isRequired: true } }),
								variant: fields.select({
									label: 'Variant',
									options: [{ label: 'hover-reveal', value: 'hover-reveal' }],
									defaultValue: 'hover-reveal',
								}),
								class: fields.text({ label: 'class', defaultValue: '!text-base' }),
							},
						}),
					},
				}),
			},
		}),
	},

	collections: {
		artworks: collection({
			label: 'Art Albums',
			slugField: 'title',
			path: 'src/content/artworks/*/',
			format: { data: 'json' },
			columns: ['title', 'draft'],
			schema: {
				draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
				featured: fields.conditional(fields.checkbox({ label: 'Featured', defaultValue: false }), {
					true: fields.select({
						label: 'Featured Position (1-3)',
						options: [
							{ label: '1 - Main', value: '1' },
							{ label: '2', value: '2' },
							{ label: '3', value: '3' },
						],
						defaultValue: '1',
					}),
					false: fields.empty(),
				}),
				author: fields.text({ label: 'Author', defaultValue: 'Daniel Adrian' }),
				title: fields.slug({ name: { label: 'Album Title (e.g., Illustrations)' } }),
				description: fields.text({
					label: 'Album Description',
					multiline: true,
					validation: { isRequired: true },
				}),
				pubDatetime: fields.datetime({ label: 'Publish Date', validation: { isRequired: true } }),
				modDatetime: fields.datetime({ label: 'Modified Date' }),
				projects: fields.array(
					fields.object({
						title: fields.text({
							label: 'Project or Sub-Section Title',
							description: 'e.g., "Daniel Adrian Blog" or "Client Work 2024"',
						}),

						images: fields.array(
							fields.object({
								title: fields.text({ label: 'Image Title (Optional)' }),
								pubDatetime: fields.datetime({
									label: 'Created Date',
									validation: { isRequired: true },
								}),
								modDatetime: fields.datetime({ label: 'Modified Date' }),
								src: fields.url({
									label: 'Cloudinary Image URL',
									validation: { isRequired: true },
								}),
								alt: fields.text({
									label: 'Image Alt Text',
									validation: { isRequired: true },
								}),
								link: fields.url({
									label: 'Associated Link (Optional)',
								}),
							}),
							{
								label: 'Images for this Project',
								itemLabel: (props) => props.fields.title.value || 'Untitled Image',
							},
						),
					}),
					{
						label: 'Projects / Sub-Sections',
						itemLabel: (props) => props.fields.title.value || 'Untitled Project',
					},
				),
			},
		}),

		blog: collection({
			label: 'Blog Posts',
			slugField: 'title',
			path: 'src/content/blog/*/',
			columns: ['title', 'draft'],
			entryLayout: 'content',
			format: {
				contentField: 'content',
			},
			schema: {
				...baseSchema(),
				canonicalURL: fields.url({ label: 'Canonical URL' }),
				content: fields.mdx({
					label: 'Content',
				}),
			},
		}),

		projects: collection({
			label: 'Projects',
			slugField: 'title',
			path: 'src/content/projects/*/',
			entryLayout: 'content',
			format: {
				contentField: 'content',
			},
			schema: {
				...baseSchema(),
				status: fields.select({
					label: 'Status',
					options: [
						{ label: 'Completed', value: 'completed' },
						{ label: 'In Progress', value: 'in-progress' },
						{ label: 'Planned', value: 'planned' },
					],
					defaultValue: 'completed',
				}),
				repoUrl: fields.url({ label: 'Repository URL' }),
				demoUrl: fields.url({ label: 'Demo URL' }),
				content: fields.mdx({
					label: 'Content',
				}),
			},
		}),

		licenses: collection({
			label: 'Licenses',
			slugField: 'name',
			path: 'src/content/licenses/*/',
			format: { data: 'json' },
			columns: ['name', 'type'],
			schema: {
				type: fields.select({
					label: 'License Type',
					options: [
						{ label: 'Blog', value: 'blog' },
						{ label: 'Project', value: 'project' },
					],
					defaultValue: 'blog',
				}),
				name: fields.slug({ name: { label: 'License Name (e.g., MIT)' } }),
				url: fields.url({ label: 'License URL' }),
				description: fields.text({
					label: 'Full License Description',
					multiline: true,
					description:
						'e.g., Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License',
				}),
			},
		}),

		series: collection({
			label: 'Series',
			slugField: 'name',
			path: 'src/content/series/*/',
			format: { data: 'json' },
			columns: ['name'],
			schema: {
				name: fields.slug({ name: { label: 'Series Name' } }),
			},
		}),

		tags: collection({
			label: 'Tags',
			slugField: 'name',
			path: 'src/content/tags/*/',
			format: { data: 'json' },
			schema: {
				name: fields.slug({ name: { label: 'Tag Name' } }),
			},
			columns: ['name'],
		}),
	},
});
