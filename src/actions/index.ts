import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { escapeHtml } from '@utils/escapeHtml';
import { stripCtl } from '@utils/stripCtl';
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export const server = {
	contact: defineAction({
		accept: 'form',
		input: z.object({
			name: z.string().min(1).max(100),
			email: z.string().email().max(254),
			message: z.string().min(1).max(5000),
			url: z.string().optional().default(''), // honeypot
		}),
		handler: async ({ name, email, message, url }) => {
			if (url.trim()) {
				throw new ActionError({ code: 'BAD_REQUEST', message: 'Spam detected.' });
			}

			const safeName = stripCtl(name);
			const safeEmail = stripCtl(email);

			const escapeName = escapeHtml(safeName);
			const escapeEmail = escapeHtml(safeEmail);
			const escapeMessage = escapeHtml(message).replace(/\n/g, '<br>');

			try {
				const { data, error } = await resend.emails.send({
					from: 'Contact Form <contact@mail.truedaniyyel.com>',
					to: ['truedaniyyel@gmail.com'],
					subject: `New Contact Form Submission from ${safeName}`,
					replyTo: `${safeName} <${safeEmail}>`,
					html: `
                        <p>You have a new contact form submission:</p>
						<p><strong>Name:</strong> ${escapeName}</p>
						<p><strong>Email:</strong> <a href="mailto:${escapeEmail}">${escapeEmail}</a></p>
						<p><strong>Message:</strong></p>
						<p>${escapeMessage}</p>
						<p style="color:#666">Sent from truedaniyyel.com</p>
                    `,
					text:
						'You have a new contact form submission:\n\n' +
						`Name: ${name}\n` +
						`Email: ${email}\n\n` +
						`Message:\n${message}\n` +
						'— Sent from truedaniyyel.com',
				});

				const id = data?.id;

				if (error || !id) {
					console.error('Resend failed', { error, data });
					throw new ActionError({
						code: 'BAD_REQUEST',
						message: 'Email could not be sent.',
					});
				}

				console.info('Mail sent', { id });
				return { ok: true };
			} catch (error: any) {
				console.error('Action error', error);
				throw new ActionError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Email could not be sent.',
				});
			}
		},
	}),
};
