import { ForumClient } from "@foru-ms/sdk"

// Singleton pattern for the forum client
let forumClient: ForumClient | null = null

export function getForumClient() {
  if (!forumClient) {
    forumClient = new ForumClient({
      apiKey: process.env.FORUM_API_KEY!,
    })
  }
  return forumClient
}

export function getAuthenticatedForumClient(token: string) {
  return new ForumClient({
    apiKey: process.env.FORUM_API_KEY!,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

// Submission status stored in thread's extendedData
export type SubmissionStatus = "pending" | "approved" | "rejected"

// Image upload structure
export interface ImageUpload {
  url: string
  name: string
}

export interface ShowcaseSubmission {
  id: string
  title: string
  description: string
  images: ImageUpload[]      // Array of all uploaded images  
  mainImageIndex: number     // Index of the main image (default: 0)
  projectUrl?: string
  authorId: string
  authorName: string
  status: SubmissionStatus
  createdAt: string
  reportId?: string
  upvotes: number
}
