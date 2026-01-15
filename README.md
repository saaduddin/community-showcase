# Community Showcase

A minimal, production-ready template for building a community showcase/gallery with user submissions, admin moderation, and upvoting.

## Features

- **Gallery View** - Browse approved submissions with search
- **Submit Projects** - Users can submit with images, descriptions, and URLs
- **Authentication** - Built-in login/register with JWT tokens
- **Admin Moderation** - Approve/reject pending submissions
- **Upvoting** - Like/unlike submissions
- **Image Uploads** - Multi-image uploads via Vercel Blob
- **Production Ready** - Zod validation, caching, optimized queries

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: [Foru.ms SDK](https://www.npmjs.com/package/@foru-ms/sdk)
- **Storage**: Vercel Blob
- **Validation**: Zod

## Quick Start

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
```

## Environment Variables

```env
FORUM_API_KEY=your_forum_api_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

## Project Structure

```
app/
├── showcase/
│   ├── actions.ts        # Server actions (auth, submissions, voting)
│   ├── page.tsx          # Main page
│   └── showcase-client.tsx
├── api/upload/           # Image upload endpoint

components/showcase/
├── auth-modal.tsx        # Login/register modal
├── submission-card.tsx   # Submission card with detail modal
├── submission-form.tsx   # New submission form
├── submission-list.tsx   # Reusable gallery component
└── image-uploader.tsx    # Multi-image uploader
```

## Customization

### Styling
Modify `app/globals.css` and component styles using Tailwind.

### Validation Rules
Edit Zod schemas in `app/showcase/actions.ts`:
```typescript
const createSubmissionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(5000),
  images: z.array(...).min(1).max(10),
  // ...
})
```

### Caching
Adjust cache TTL in `actions.ts`:
```typescript
const getCachedApproved = unstable_cache(
  fetchApprovedInternal,
  ["approved-submissions"],
  { revalidate: 60 } // seconds
)
```

## License

MIT
