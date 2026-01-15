import { ForumClient } from "@foru-ms/sdk"

// Singleton pattern for the forum client
let forumClient: ForumClient | null = null

export function getForumClient() {
  if (!forumClient) {
    forumClient = new ForumClient({
      apiKey: process.env.FORUMS_API_KEY!,
      baseUrl: process.env.FORUMS_BASE_URL || "https://api.foru.ms/v1",
    })
  }
  return forumClient
}

export function getAuthenticatedForumClient(token: string) {
  const client = new ForumClient({
    apiKey: process.env.FORUMS_API_KEY!,
    baseUrl: process.env.FORUMS_BASE_URL || "https://api.foru.ms/v1",
  })
  client.setToken(token)
  return client
}

// Submission status stored in thread's extendedData
export type SubmissionStatus = "pending" | "approved" | "rejected"

export interface ShowcaseSubmission {
  id: string
  title: string
  description: string
  imageUrl?: string
  projectUrl?: string
  authorId: string
  authorName: string
  status: SubmissionStatus
  createdAt: string
  reportId?: string
}
