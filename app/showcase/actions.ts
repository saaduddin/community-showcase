"use server"

import { ForumClient } from "@foru-ms/sdk"
import { cookies } from "next/headers"
import { unstable_cache, revalidatePath } from "next/cache"
import { z } from "zod"

// =============================================================================
// Types
// =============================================================================

export type SubmissionStatus = "pending" | "approved" | "rejected"

export interface ImageUpload {
  url: string
  name: string
}

export interface ShowcaseSubmission {
  id: string
  title: string
  description: string
  images: ImageUpload[]
  mainImageIndex: number
  projectUrl?: string
  authorId: string
  authorName: string
  status: SubmissionStatus
  createdAt: string
  reportId?: string
  upvotes: number
}

type ActionError =
  | { code: "UNAUTHORIZED"; message: string }
  | { code: "VALIDATION_ERROR"; message: string; details?: z.ZodIssue[] }
  | { code: "NOT_FOUND"; message: string }
  | { code: "RATE_LIMITED"; message: string }
  | { code: "INTERNAL_ERROR"; message: string }

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: ActionError }

// Internal SDK types
interface ThreadData {
  id: string
  title: string
  body: string
  extendedData: Record<string, unknown> | null
  createdAt: string
  userId?: string
  _count?: { reactions: number }
}

interface UserRole { id: string; name: string; slug: string }
interface UserData { id: string; username: string; email?: string; displayName?: string | null; roles?: UserRole[] }
interface ReportData { id: string; type: string; status?: string; threadId?: string }
interface AuthContext { token: string; user: UserData; client: ForumClient; isAdmin: boolean }

// =============================================================================
// Validation Schemas
// =============================================================================

const loginSchema = z.object({
  login: z.string().min(1, "Login is required"),
  password: z.string().min(1, "Password is required"),
})

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().max(50).optional(),
})

const createSubmissionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(5000),
  images: z.array(z.object({ url: z.string().url(), name: z.string() })).min(1).max(10),
  mainImageIndex: z.number().int().min(0),
  projectUrl: z.string().url().optional().or(z.literal("")),
})

const idSchema = z.string().min(1)

// =============================================================================
// Client & Auth Helpers
// =============================================================================

function getForumClient() {
  return new ForumClient({ apiKey: process.env.FORUM_API_KEY! })
}

function getAuthenticatedForumClient(token: string) {
  return new ForumClient({
    apiKey: process.env.FORUM_API_KEY!,
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function getUserToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("forum_token")?.value || null
}

async function getAuthContext(): Promise<AuthContext | null> {
  const token = await getUserToken()
  if (!token) return null
  try {
    const client = getAuthenticatedForumClient(token)
    const user = (await client.auth.me()).data as UserData
    const isAdmin = user.roles?.some(r => r.slug === "admin" || r.name === "admin") || false
    return { token, user, client, isAdmin }
  } catch {
    return null
  }
}

// Map thread to ShowcaseSubmission
function threadToSubmission(thread: ThreadData, reportId?: string): ShowcaseSubmission {
  const ext = thread.extendedData || {}
  return {
    id: thread.id,
    title: thread.title,
    description: thread.body || "",
    images: (ext.images as ImageUpload[]) || [],
    mainImageIndex: (ext.mainImageIndex as number) || 0,
    projectUrl: ext.projectUrl as string | undefined,
    authorId: thread.userId || "",
    authorName: (ext.authorName as string) || "Anonymous",
    status: (ext.status as SubmissionStatus) || "pending",
    createdAt: thread.createdAt || new Date().toISOString(),
    reportId,
    upvotes: thread._count?.reactions || 0,
  }
}

// Paginate through all items
async function paginateAll<T>(
  fetchFn: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>
): Promise<T[]> {
  const allItems: T[] = []
  let cursor: string | undefined
  do {
    const result = await fetchFn(cursor)
    allItems.push(...result.items)
    cursor = result.nextCursor
  } while (cursor)
  return allItems
}

// =============================================================================
// Auth Actions
// =============================================================================

export async function getCurrentUser(): Promise<UserData | null> {
  const token = await getUserToken()
  if (!token) return null
  try {
    return (await getAuthenticatedForumClient(token).auth.me()).data as UserData
  } catch {
    return null
  }
}

export async function isUserAdmin(): Promise<boolean> {
  return (await getAuthContext())?.isAdmin || false
}

export async function loginUser(login: string, password: string): Promise<ActionResult> {
  const validation = loginSchema.safeParse({ login, password })
  if (!validation.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.errors[0]?.message || "Invalid input" } }
  }

  try {
    const response = await getForumClient().auth.login({ login, password })
    const cookieStore = await cookies()
    cookieStore.set("forum_token", response.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    })
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e && e.statusCode === 429) {
      return { success: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }
    }
    return { success: false, error: { code: "UNAUTHORIZED", message: "Invalid credentials" } }
  }
}

export async function logoutUser() {
  (await cookies()).delete("forum_token")
  return { success: true }
}

export async function registerUser(data: {
  username: string
  email: string
  password: string
  displayName?: string
}): Promise<ActionResult> {
  const validation = registerSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.errors[0]?.message || "Invalid input" } }
  }

  try {
    const response = await getForumClient().auth.register(data)
    const cookieStore = await cookies()
    cookieStore.set("forum_token", response.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    })
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e && e.statusCode === 429) {
      return { success: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }
    }
    return { success: false, error: { code: "INTERNAL_ERROR", message: "Registration failed. Username or email may exist." } }
  }
}

// =============================================================================
// Submission Actions
// =============================================================================

export async function createSubmission(data: {
  title: string
  description: string
  images: ImageUpload[]
  mainImageIndex: number
  projectUrl?: string
}): Promise<ActionResult<{ threadId: string }>> {
  const validation = createSubmissionSchema.safeParse(data)
  if (!validation.success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: validation.error.errors[0]?.message || "Invalid input" } }
  }

  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }

  try {
    const thread = (await ctx.client.threads.create({
      title: data.title,
      body: data.description,
      extendedData: {
        type: "showcase_submission",
        images: data.images,
        mainImageIndex: data.mainImageIndex,
        projectUrl: data.projectUrl || "",
        status: "pending",
        authorName: ctx.user.displayName || ctx.user.username,
      },
    })).data as ThreadData

    await ctx.client.reports.create({
      threadId: thread.id,
      type: "showcase_submission",
      status: "pending",
      description: `New submission: ${data.title}`,
    })

    revalidatePath("/showcase")
    return { success: true, data: { threadId: thread.id } }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "statusCode" in e && e.statusCode === 429) {
      return { success: false, error: { code: "RATE_LIMITED", message: "Too many requests." } }
    }
    return { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create submission" } }
  }
}

// Cached approved submissions (60s TTL)
const fetchApprovedInternal = async (): Promise<ShowcaseSubmission[]> => {
  try {
    const threads = await paginateAll<ThreadData>(async (cursor) => {
      const res = await getForumClient().threads.list({ cursor, limit: 50 })
      return { items: res.data.items as ThreadData[], nextCursor: res.data.nextCursor }
    })
    return threads
      .filter(t => t.extendedData?.type === "showcase_submission" && t.extendedData?.status === "approved")
      .map(t => threadToSubmission(t))
  } catch {
    return []
  }
}

const getCachedApproved = unstable_cache(fetchApprovedInternal, ["approved-submissions"], { revalidate: 60 })

export async function getApprovedSubmissions(): Promise<ShowcaseSubmission[]> {
  return getCachedApproved()
}

export async function getMySubmissions(): Promise<ShowcaseSubmission[]> {
  const ctx = await getAuthContext()
  if (!ctx) return []

  try {
    const threads = await paginateAll<ThreadData>(async (cursor) => {
      const res = await ctx.client.threads.list({ cursor, limit: 50, userId: ctx.user.id })
      return { items: res.data.items as ThreadData[], nextCursor: res.data.nextCursor }
    })
    return threads
      .filter(t => t.extendedData?.type === "showcase_submission")
      .map(t => threadToSubmission(t))
  } catch {
    return []
  }
}

export async function getPendingSubmissions(): Promise<ShowcaseSubmission[]> {
  const ctx = await getAuthContext()
  if (!ctx?.isAdmin) return []

  try {
    const reports = await paginateAll<ReportData>(async (cursor) => {
      const res = await ctx.client.reports.list({ cursor, status: "pending", limit: 50 })
      return { items: res.data.items as ReportData[], nextCursor: res.data.nextCursor }
    })

    const showcaseReports = reports.filter(r => r.type === "showcase_submission" && r.threadId)
    const results = await Promise.all(
      showcaseReports.map(r =>
        ctx.client.threads.retrieve({ id: r.threadId! })
          .then(res => ({ report: r, thread: res.data as ThreadData }))
          .catch(() => null)
      )
    )

    return results
      .filter((r): r is { report: ReportData; thread: ThreadData } =>
        r !== null && r.thread?.extendedData?.type === "showcase_submission"
      )
      .map(({ report, thread }) => threadToSubmission(thread, report.id))
  } catch {
    return []
  }
}

// =============================================================================
// Admin Actions
// =============================================================================

export async function approveSubmission(threadId: string, reportId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(threadId).success || !idSchema.safeParse(reportId).success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid ID" } }
  }

  const ctx = await getAuthContext()
  if (!ctx?.isAdmin) return { success: false, error: { code: "UNAUTHORIZED", message: "Not authorized" } }

  try {
    const current = (await ctx.client.threads.retrieve({ id: threadId })).data?.extendedData || {}
    await ctx.client.threads.update({ id: threadId, extendedData: { ...current, status: "approved" } })
    await ctx.client.reports.update({ id: reportId, status: "approved" })
    revalidatePath("/showcase")
    return { success: true }
  } catch {
    return { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to approve" } }
  }
}

export async function rejectSubmission(threadId: string, reportId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(threadId).success || !idSchema.safeParse(reportId).success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid ID" } }
  }

  const ctx = await getAuthContext()
  if (!ctx?.isAdmin) return { success: false, error: { code: "UNAUTHORIZED", message: "Not authorized" } }

  try {
    const current = (await ctx.client.threads.retrieve({ id: threadId })).data?.extendedData || {}
    await ctx.client.threads.update({ id: threadId, extendedData: { ...current, status: "rejected" } })
    await ctx.client.reports.update({ id: reportId, status: "rejected" })
    revalidatePath("/showcase")
    return { success: true }
  } catch {
    return { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to reject" } }
  }
}

// =============================================================================
// Voting
// =============================================================================

export async function toggleUpvote(threadId: string): Promise<ActionResult<{ action: "liked" | "unliked" }>> {
  if (!idSchema.safeParse(threadId).success) {
    return { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid thread ID" } }
  }

  const ctx = await getAuthContext()
  if (!ctx) return { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }

  try {
    const reactions = (await ctx.client.threads.listReactions({ id: threadId })).data.items
    const existing = reactions.find(r => r.userId === ctx.user.id && r.type === "LIKE")

    if (existing) {
      await ctx.client.threads.deleteReaction({ id: threadId, subId: existing.id })
      return { success: true, data: { action: "unliked" } }
    } else {
      await ctx.client.threads.createReaction({ id: threadId, type: "LIKE" })
      return { success: true, data: { action: "liked" } }
    }
  } catch {
    return { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to vote" } }
  }
}
