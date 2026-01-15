"use server"

import { ForumClient } from "@foru-ms/sdk"
import { cookies } from "next/headers"
import { unstable_cache, revalidatePath } from "next/cache"
import { z } from "zod"

// ============================================================================
// Validation Schemas
// ============================================================================

const loginSchema = z.object({
  login: z.string().min(1, "Login is required"),
  password: z.string().min(1, "Password is required"),
})

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().max(50).optional(),
})

const createSubmissionSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(10, "Description must be at least 10 characters").max(5000),
  images: z.array(z.object({
    url: z.string().url("Invalid image URL"),
    name: z.string(),
  })).min(1, "At least one image is required").max(10),
  mainImageIndex: z.number().int().min(0),
  projectUrl: z.string().url("Invalid project URL").optional().or(z.literal("")),
})

const idSchema = z.string().min(1, "ID is required")

// ============================================================================
// Structured Error Types
// ============================================================================

type ActionError =
  | { code: "UNAUTHORIZED"; message: string }
  | { code: "VALIDATION_ERROR"; message: string; details?: z.ZodIssue[] }
  | { code: "NOT_FOUND"; message: string }
  | { code: "RATE_LIMITED"; message: string; retryAfter?: number }
  | { code: "INTERNAL_ERROR"; message: string }

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: ActionError }

// ============================================================================
// Type definitions for v2 SDK thread data shape
// ============================================================================
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



interface UserRole {
  id: string
  name: string
  slug: string
}

interface UserData {
  id: string
  username: string
  email?: string
  displayName?: string | null
  roles?: UserRole[]
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

// Get auth context with token, user, and client in one call
// Eliminates redundant auth.me() calls across multiple functions
interface AuthContext {
  token: string
  user: UserData
  client: ForumClient
  isAdmin: boolean
}

async function getAuthContext(): Promise<AuthContext | null> {
  const token = await getUserToken()
  if (!token) return null

  try {
    const client = getAuthenticatedForumClient(token)
    const response = await client.auth.me()
    const user = response.data as UserData
    const isAdmin = user.roles?.some(r => r.slug === "admin" || r.name === "admin") || false
    return { token, user, client, isAdmin }
  } catch {
    return null
  }
}

// Check if user is admin
export async function isUserAdmin(): Promise<boolean> {
  const ctx = await getAuthContext()
  return ctx?.isAdmin || false
}

// Login user
export async function loginUser(login: string, password: string): Promise<ActionResult> {
  // Validate input
  const validation = loginSchema.safeParse({ login, password })
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.errors[0]?.message || "Invalid input",
        details: validation.error.errors,
      },
    }
  }

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
  } catch (error: unknown) {
    console.error("[loginUser] Failed:", error)
    // Check for rate limiting
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 429) {
      return {
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many login attempts. Please try again later." },
      }
    }
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid credentials" },
    }
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
}): Promise<ActionResult> {
  // Validate input
  const validation = registerSchema.safeParse(data)
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.errors[0]?.message || "Invalid input",
        details: validation.error.errors,
      },
    }
  }

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
  } catch (error: unknown) {
    console.error("Registration failed:", error)
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 429) {
      return {
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many registration attempts. Please try again later." },
      }
    }
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Registration failed. Username or email may already exist." },
    }
  }
}

// Create a new submission (thread + report for admin review)
export async function createSubmission(data: {
  title: string
  description: string
  images: ImageUpload[]
  mainImageIndex: number
  projectUrl?: string
}): Promise<ActionResult<{ threadId: string }>> {
  // Validate input
  const validation = createSubmissionSchema.safeParse(data)
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.errors[0]?.message || "Invalid input",
        details: validation.error.errors,
      },
    }
  }

  const ctx = await getAuthContext()
  if (!ctx) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Not authenticated" },
    }
  }

  try {
    // Create thread with extendedData
    const threadResponse = await ctx.client.threads.create({
      title: data.title,
      body: data.description,
      extendedData: {
        type: "showcase_submission",
        images: data.images,
        mainImageIndex: data.mainImageIndex,
        projectUrl: data.projectUrl || "",
        status: "pending" as SubmissionStatus,
        authorName: ctx.user.displayName || ctx.user.username,
        upvotes: 0,
      },
    })
    const thread = threadResponse.data as ThreadData | undefined

    if (!thread) {
      throw new Error("Failed to create thread")
    }

    // Create a report for admin review
    await ctx.client.reports.create({
      threadId: thread.id,
      type: "showcase_submission",
      status: "pending",
      description: `New showcase submission: ${data.title}`,
    })

    // Invalidate submissions cache
    revalidatePath("/showcase")

    return { success: true, data: { threadId: thread.id } }
  } catch (error: unknown) {
    console.error("Failed to create submission:", error)
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 429) {
      return {
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
      }
    }
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create submission" },
    }
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

// Internal function to fetch approved submissions (used for caching)
async function fetchApprovedSubmissionsInternal(): Promise<ShowcaseSubmission[]> {
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

// Cached version of approved submissions (60 second TTL)
const getCachedApprovedSubmissions = unstable_cache(
  fetchApprovedSubmissionsInternal,
  ["approved-submissions"],
  { revalidate: 60, tags: ["submissions"] }
)

// Get all approved submissions (public) - uses caching
export async function getApprovedSubmissions(): Promise<ShowcaseSubmission[]> {
  return getCachedApprovedSubmissions()
}

// Get user's own submissions
export async function getMySubmissions(): Promise<ShowcaseSubmission[]> {
  const ctx = await getAuthContext()
  if (!ctx) return []

  try {
    const threads = await paginateAll<ThreadData>(async (cursor) => {
      const response = await ctx.client.threads.list({ cursor, limit: 50, userId: ctx.user.id })
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
// Optimized: Uses Promise.all for batch fetching instead of sequential N+1 queries
export async function getPendingSubmissions(): Promise<ShowcaseSubmission[]> {
  const ctx = await getAuthContext()
  if (!ctx?.isAdmin) return []

  try {
    const reports = await paginateAll<ReportData>(async (cursor) => {
      const response = await ctx.client.reports.list({ cursor, status: "pending", limit: 50 })
      return {
        items: response.data.items as ReportData[],
        nextCursor: response.data.nextCursor,
      }
    })

    // Filter showcase submission reports and extract thread IDs
    const showcaseReports = reports.filter(
      (r) => r.type === "showcase_submission" && r.threadId
    )

    // Batch fetch all threads in parallel (fixes N+1 query problem)
    const threadPromises = showcaseReports.map((report) =>
      ctx.client.threads
        .retrieve({ id: report.threadId! })
        .then((res) => ({ report, thread: res.data as ThreadData | undefined }))
        .catch(() => ({ report, thread: undefined })) // Handle deleted threads
    )

    const results = await Promise.all(threadPromises)

    return results
      .filter(
        ({ thread }) =>
          thread?.extendedData?.type === "showcase_submission"
      )
      .map(({ report, thread }) => ({
        id: thread!.id,
        title: thread!.title,
        description: thread!.body || "",
        images: (thread!.extendedData!.images as ImageUpload[]) || [],
        mainImageIndex: (thread!.extendedData!.mainImageIndex as number) || 0,
        projectUrl: thread!.extendedData!.projectUrl as string | undefined,
        authorId: thread!.userId || "",
        authorName: (thread!.extendedData!.authorName as string) || "Anonymous",
        status: "pending" as SubmissionStatus,
        reportId: report.id,
        createdAt: thread!.createdAt || new Date().toISOString(),
        upvotes: thread!._count?.reactions || 0,
      }))
  } catch (error) {
    console.error("Failed to fetch pending submissions:", error)
    return []
  }
}

// Approve a submission (admin only)
export async function approveSubmission(threadId: string, reportId: string): Promise<ActionResult> {
  // Validate inputs
  const threadValidation = idSchema.safeParse(threadId)
  const reportValidation = idSchema.safeParse(reportId)
  if (!threadValidation.success || !reportValidation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid thread or report ID" },
    }
  }

  const ctx = await getAuthContext()
  if (!ctx?.isAdmin) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Not authorized" },
    }
  }

  try {
    // Get current thread data to preserve other fields
    const threadResponse = await ctx.client.threads.retrieve({ id: threadId })
    const currentExtendedData = threadResponse.data?.extendedData || {}

    // Update thread status to approved
    await ctx.client.threads.update({
      id: threadId,
      extendedData: {
        ...currentExtendedData,
        status: "approved",
      },
    })

    // Update report status
    await ctx.client.reports.update({ id: reportId, status: "approved" })

    // Invalidate cache
    revalidatePath("/showcase")

    return { success: true }
  } catch (error: unknown) {
    console.error("Failed to approve submission:", error)
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 404) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Submission not found" },
      }
    }
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to approve submission" },
    }
  }
}

// Reject a submission (admin only)
export async function rejectSubmission(threadId: string, reportId: string): Promise<ActionResult> {
  // Validate inputs
  const threadValidation = idSchema.safeParse(threadId)
  const reportValidation = idSchema.safeParse(reportId)
  if (!threadValidation.success || !reportValidation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid thread or report ID" },
    }
  }

  const ctx = await getAuthContext()
  if (!ctx?.isAdmin) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Not authorized" },
    }
  }

  try {
    // Get current thread data to preserve other fields
    const threadResponse = await ctx.client.threads.retrieve({ id: threadId })
    const currentExtendedData = threadResponse.data?.extendedData || {}

    // Update thread status to rejected
    await ctx.client.threads.update({
      id: threadId,
      extendedData: {
        ...currentExtendedData,
        status: "rejected",
      },
    })

    // Update report status
    await ctx.client.reports.update({ id: reportId, status: "rejected" })

    // Invalidate cache
    revalidatePath("/showcase")

    return { success: true }
  } catch (error: unknown) {
    console.error("Failed to reject submission:", error)
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 404) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Submission not found" },
      }
    }
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to reject submission" },
    }
  }
}

// Toggle upvote (using native reactions)
export async function toggleUpvote(threadId: string): Promise<ActionResult<{ action: "liked" | "unliked" }>> {
  // Validate input
  const validation = idSchema.safeParse(threadId)
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid thread ID" },
    }
  }

  const ctx = await getAuthContext()
  if (!ctx) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Not authenticated" },
    }
  }

  try {
    // Check if user already liked the thread
    const reactionsResponse = await ctx.client.threads.listReactions({ id: threadId })
    const reactions = reactionsResponse.data.items

    const existingLike = reactions.find(r => r.userId === ctx.user.id && r.type === "LIKE")

    if (existingLike) {
      // Unlike: Delete the reaction
      await ctx.client.threads.deleteReaction({
        id: threadId,
        subId: existingLike.id
      })
      return { success: true, data: { action: "unliked" } }
    } else {
      // Like: Create a new reaction
      await ctx.client.threads.createReaction({
        id: threadId,
        type: "LIKE"
      })
      return { success: true, data: { action: "liked" } }
    }
  } catch (error: unknown) {
    console.error("Failed to vote:", error)
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 404) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Thread not found" },
      }
    }
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 429) {
      return {
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
      }
    }
    return {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to vote" },
    }
  }
}
