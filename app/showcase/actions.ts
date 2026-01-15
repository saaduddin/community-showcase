"use server"

import { ForumClient } from "@foru-ms/sdk"
import { cookies } from "next/headers"

// Type definitions for v2 SDK thread data shape
interface ThreadData {
  id: string
  title: string
  body: string
  slug: string | null
  locked: boolean | null
  pinned: boolean | null
  views: number
  postsCount: number
  lastPostAt: string | null
  extendedData: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  userId?: string
  tags?: string[]
  _count?: {
    reactions: number
  }
}



interface UserData {
  id: string
  username: string
  email?: string
  displayName?: string | null
  roles?: string[]
}

interface ReportData {
  id: string
  type: string
  description?: string
  status?: string
  threadId?: string
  postId?: string
  reportedId?: string
  createdAt?: string
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
  hasUpvoted?: boolean
}

// Get base forum client (API key only)
function getForumClient() {
  return new ForumClient({
    apiKey: process.env.FORUM_API_KEY!,
  })
}

// Get authenticated forum client with JWT token in headers
function getAuthenticatedForumClient(token: string) {
  return new ForumClient({
    apiKey: process.env.FORUM_API_KEY!,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

// Get user token from cookies
async function getUserToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("forum_token")?.value || null
}

// Get current user info
export async function getCurrentUser(): Promise<UserData | null> {
  const token = await getUserToken()
  if (!token) return null

  try {
    const client = getAuthenticatedForumClient(token)
    const response = await client.auth.me()
    return response.data as UserData
  } catch {
    return null
  }
}

// Check if user is admin
export async function isUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  return user.roles?.includes("admin") || false
}

// Login user
export async function loginUser(login: string, password: string) {
  try {
    const client = getForumClient()
    const response = await client.auth.login({ login, password })

    const cookieStore = await cookies()
    cookieStore.set("forum_token", response.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })

    return { success: true }
  } catch (error: any) {
    console.error("[loginUser] Failed:", JSON.stringify(error, null, 2))
    return { success: false, error: "Invalid credentials" }
  }
}

// Logout user
export async function logoutUser() {
  const cookieStore = await cookies()
  cookieStore.delete("forum_token")
  return { success: true }
}

// Register user for sign up
export async function registerUser(data: {
  username: string
  email: string
  password: string
  displayName?: string
}) {
  try {
    const client = getForumClient()
    const response = await client.auth.register({
      username: data.username,
      email: data.email,
      password: data.password,
      displayName: data.displayName,
    })

    const cookieStore = await cookies()
    cookieStore.set("forum_token", response.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })

    return { success: true }
  } catch (error) {
    console.error("Registration failed:", error)
    return { success: false, error: "Registration failed. Username or email may already exist." }
  }
}

// Create a new submission (thread + report for admin review)
export async function createSubmission(data: {
  title: string
  description: string
  images: ImageUpload[]
  mainImageIndex: number
  projectUrl?: string
}) {
  const token = await getUserToken()
  if (!token) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    const client = getAuthenticatedForumClient(token)
    const userResponse = await client.auth.me()
    const user = userResponse.data as UserData

    // Create thread with extendedData
    const threadResponse = await client.threads.create({
      title: data.title,
      body: data.description,
      extendedData: {
        type: "showcase_submission",
        images: data.images,
        mainImageIndex: data.mainImageIndex,
        projectUrl: data.projectUrl || "",
        status: "pending" as SubmissionStatus,
        authorName: user.displayName || user.username,
        upvotes: 0,
      },
    })
    const thread = threadResponse.data as ThreadData | undefined

    if (!thread) {
      throw new Error("Failed to create thread")
    }

    // Create a report for admin review (userId = reporter)
    // Use the authenticated client so the report is created by the user
    await client.reports.create({
      threadId: thread.id,
      userId: user.id,
      reportedId: user.id,
      type: "showcase_submission",
      description: `New showcase submission: ${data.title}`,
    })

    return { success: true, threadId: thread.id }
  } catch (error) {
    console.error("Failed to create submission:", error)
    return { success: false, error: "Failed to create submission" }
  }
}

// Helper to paginate through all items
async function paginateAll<T>(
  fetchFn: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>
): Promise<T[]> {
  const allItems: T[] = []
  let cursor: string | undefined = undefined

  do {
    const result = await fetchFn(cursor)
    allItems.push(...result.items)
    cursor = result.nextCursor
  } while (cursor)

  return allItems
}

// Get all approved submissions (public)
export async function getApprovedSubmissions(): Promise<ShowcaseSubmission[]> {
  try {
    const client = getForumClient()

    const threads = await paginateAll<ThreadData>(async (cursor) => {
      const response = await client.threads.list({ cursor, limit: 50 })
      return {
        items: response.data.items as ThreadData[],
        nextCursor: response.data.nextCursor,
      }
    })

    return threads
      .filter(
        (thread) =>
          thread.extendedData?.type === "showcase_submission" &&
          thread.extendedData?.status === "approved"
      )
      .map((thread) => ({
        id: thread.id,
        title: thread.title,
        description: thread.body || "",
        images: (thread.extendedData?.images as ImageUpload[]) || [],
        mainImageIndex: (thread.extendedData?.mainImageIndex as number) || 0,
        projectUrl: thread.extendedData?.projectUrl as string | undefined,
        authorId: thread.userId || "",
        authorName: (thread.extendedData?.authorName as string) || "Anonymous",
        status: thread.extendedData?.status as SubmissionStatus,
        createdAt: thread.createdAt || new Date().toISOString(),

        upvotes: thread._count?.reactions || 0,
      }))
  } catch (error) {
    console.error("Failed to fetch submissions:", error)
    return []
  }
}

// Get user's own submissions
export async function getMySubmissions(): Promise<ShowcaseSubmission[]> {
  const token = await getUserToken()
  if (!token) return []

  try {
    const client = getAuthenticatedForumClient(token)
    const userResponse = await client.auth.me()
    const user = userResponse.data as UserData

    const threads = await paginateAll<ThreadData>(async (cursor) => {
      const response = await client.threads.list({ cursor, limit: 50, userId: user.id })
      return {
        items: response.data.items as ThreadData[],
        nextCursor: response.data.nextCursor,
      }
    })

    return threads
      .filter((thread) => thread.extendedData?.type === "showcase_submission")
      .map((thread) => ({
        id: thread.id,
        title: thread.title,
        description: thread.body || "",
        images: (thread.extendedData?.images as ImageUpload[]) || [],
        mainImageIndex: (thread.extendedData?.mainImageIndex as number) || 0,
        projectUrl: thread.extendedData?.projectUrl as string | undefined,
        authorId: thread.userId || "",
        authorName: (thread.extendedData?.authorName as string) || "Anonymous",
        status: (thread.extendedData?.status as SubmissionStatus) || "pending",
        createdAt: thread.createdAt || new Date().toISOString(),

        upvotes: thread._count?.reactions || 0,
      }))
  } catch (error) {
    console.error("Failed to fetch my submissions:", error)
    return []
  }
}

// Get all pending submissions (admin only)
export async function getPendingSubmissions(): Promise<ShowcaseSubmission[]> {
  const isAdmin = await isUserAdmin()
  if (!isAdmin) return []

  try {
    const client = getForumClient()
    const submissions: ShowcaseSubmission[] = []

    const reports = await paginateAll<ReportData>(async (cursor) => {
      const response = await client.reports.list({ cursor, status: "pending", limit: 50 })
      return {
        items: response.data.items as ReportData[],
        nextCursor: response.data.nextCursor,
      }
    })

    for (const report of reports) {
      if (report.type === "showcase_submission" && report.threadId) {
        try {
          const threadResponse = await client.threads.retrieve({ id: report.threadId })
          const thread = threadResponse.data as ThreadData | undefined
          if (thread?.extendedData?.type === "showcase_submission") {
            submissions.push({
              id: thread.id,
              title: thread.title,
              description: thread.body || "",
              images: (thread.extendedData.images as ImageUpload[]) || [],
              mainImageIndex: (thread.extendedData.mainImageIndex as number) || 0,
              projectUrl: thread.extendedData.projectUrl as string | undefined,
              authorId: thread.userId || "",
              authorName: (thread.extendedData.authorName as string) || "Anonymous",
              status: "pending",
              reportId: report.id,
              createdAt: thread.createdAt || new Date().toISOString(),
              upvotes: thread._count?.reactions || 0,
            })
          }
        } catch {
          // Thread might have been deleted
        }
      }
    }

    return submissions
  } catch (error) {
    console.error("Failed to fetch pending submissions:", error)
    return []
  }
}

// Approve a submission (admin only)
export async function approveSubmission(threadId: string, reportId: string) {
  const isAdmin = await isUserAdmin()
  if (!isAdmin) {
    return { success: false, error: "Not authorized" }
  }

  try {
    const client = getForumClient()

    // Get current thread data to preserve other fields
    const threadResponse = await client.threads.retrieve({ id: threadId })
    const currentExtendedData = threadResponse.data?.extendedData || {}

    // Update thread status to approved
    await client.threads.update({
      id: threadId,
      extendedData: {
        ...currentExtendedData,
        status: "approved",
      },
    })

    // Update report status
    await client.reports.update({ id: reportId, status: "approved" })

    return { success: true }
  } catch (error) {
    console.error("Failed to approve submission:", error)
    return { success: false, error: "Failed to approve submission" }
  }
}

// Reject a submission (admin only)
export async function rejectSubmission(threadId: string, reportId: string) {
  const isAdmin = await isUserAdmin()
  if (!isAdmin) {
    return { success: false, error: "Not authorized" }
  }

  try {
    const client = getForumClient()

    // Get current thread data to preserve other fields
    const threadResponse = await client.threads.retrieve({ id: threadId })
    const currentExtendedData = threadResponse.data?.extendedData || {}

    // Update thread status to rejected
    await client.threads.update({
      id: threadId,
      extendedData: {
        ...currentExtendedData,
        status: "rejected",
      },
    })

    // Update report status
    await client.reports.update({ id: reportId, status: "rejected" })

    return { success: true }
  } catch (error) {
    console.error("Failed to reject submission:", error)
    return { success: false, error: "Failed to reject submission" }
  }
}

// Toggle upvote (using native reactions)
export async function toggleUpvote(threadId: string) {
  const token = await getUserToken()
  if (!token) return { success: false, error: "Not authenticated" }

  try {
    const client = getAuthenticatedForumClient(token)
    const userResponse = await client.auth.me()
    const user = userResponse.data as UserData

    // Check if user already liked the thread
    // List reactions and check if any belong to the current user (filter client-side)
    const reactionsResponse = await client.threads.listReactions({ id: threadId })
    const reactions = reactionsResponse.data.items

    const existingLike = reactions.find(r => r.userId === user.id && r.type === "LIKE")

    if (existingLike) {
      // Unlike: Delete the reaction using its ID
      await client.threads.deleteReaction({
        id: threadId,
        subId: existingLike.id
      })
      return { success: true, action: "unliked" }
    } else {
      // Like: Create a new reaction
      await client.threads.createReaction({
        id: threadId,
        type: "LIKE"
      })
      return { success: true, action: "liked" }
    }
  } catch (error) {
    console.error("Failed to vote:", error)
    return { success: false, error: "Failed to vote" }
  }
}
