import { Resend } from 'resend';
import { db } from '@/lib/db'; // Your database client connection

// Dynamically pull the key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { title, excerpt, slug, content } = await request.json();

    // Step A: Save post/job to your database
    const newPost = await db.query(
      'INSERT INTO posts (title, excerpt, slug, content) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, excerpt, slug, content]
    );

    // Step B: Fetch active subscribers
    const subscribersResult = await db.query('SELECT email FROM subscribers');
    const subscriberEmails = subscribersResult.rows.map(sub => sub.email);

    // Step C: Send batch email notification
    if (subscriberEmails.length > 0) {
      await resend.emails.send({
        from: 'St. Josephine Bakhita Alumni <onboarding@resend.dev>',
        to: subscriberEmails,
        subject: `New Post: ${title}`,
        html: `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <h1 style="color: #1a56db;">${title}</h1>
            <p>${excerpt}</p>
            <p>
              <a href="https://your-site.vercel.app/news/${slug}" 
                 style="background-color: #1a56db; color: white; padding: 10px 18px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Read full update
              </a>
            </p>
            <hr />
            <p style="font-size: 12px; color: #777;">
              You received this email because you subscribed to updates on our platform.
            </p>
          </div>
        `
      });
    }

    return Response.json({ success: true, post: newPost });

  } catch (error) {
    console.error('Failed to publish post or send emails:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}