"use server"

import {
  getForumClient,
  getAuthenticatedForumClient,
  type SubmissionStatus,
  type ShowcaseSubmission,
} from "@/lib/forum-client"
import { cookies } from "next/headers"

// Get user token from cookies
async function getUserToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("forum_token")?.value || null
}

// Get current user info
export async function getCurrentUser() {
  const token = await getUserToken()
  if (!token) return null

  try {
    const client = getAuthenticatedForumClient(token)
    const user = await client.auth.me()
    return user
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
    cookieStore.set("forum_token", response.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })

    return { success: true }
  } catch (error) {
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
    cookieStore.set("forum_token", response.token, {
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
  imageUrl?: string
  projectUrl?: string
}) {
  const token = await getUserToken()
  if (!token) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    const client = getAuthenticatedForumClient(token)
    const user = await client.auth.me()

    // Create thread with pending status
    const thread = await client.threads.create({
      title: data.title,
      body: data.description,
      extendedData: {
        type: "showcase_submission",
        imageUrl: data.imageUrl || "",
        projectUrl: data.projectUrl || "",
        status: "pending" as SubmissionStatus,
        authorName: user.displayName || user.username,
      },
    })

    // Create a report for admin review (reporter = submitter)
    const adminClient = getForumClient()
    await adminClient.reports.create({
      threadId: thread.id,
      reporterId: user.id,
      reportedId: user.id,
      type: "showcase_submission",
      description: `New showcase submission: ${data.title}`,
      status: "pending",
    })

    return { success: true, threadId: thread.id }
  } catch (error) {
    console.error("Failed to create submission:", error)
    return { success: false, error: "Failed to create submission" }
  }
}

// Get all approved submissions (public)
export async function getApprovedSubmissions(): Promise<ShowcaseSubmission[]> {
  try {
    const client = getForumClient()
    const threads: ShowcaseSubmission[] = []

    for await (const thread of client.pagination.paginateAll((cursor) =>
      client.threads.list({ cursor, filter: "newest", limit: 50 }),
    )) {
      if (thread.extendedData?.type === "showcase_submission" && thread.extendedData?.status === "approved") {
        threads.push({
          id: thread.id,
          title: thread.title,
          description: thread.body || "",
          imageUrl: thread.extendedData.imageUrl,
          projectUrl: thread.extendedData.projectUrl,
          authorId: thread.creatorId || "",
          authorName: thread.extendedData.authorName || "Anonymous",
          status: thread.extendedData.status,
          createdAt: thread.createdAt || new Date().toISOString(),
        })
      }
    }

    return threads
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
    const user = await client.auth.me()
    const threads: ShowcaseSubmission[] = []

    for await (const thread of client.pagination.paginateAll((cursor) =>
      client.users.getThreads(user.id, { cursor, filter: "newest", limit: 50 }),
    )) {
      if (thread.extendedData?.type === "showcase_submission") {
        threads.push({
          id: thread.id,
          title: thread.title,
          description: thread.body || "",
          imageUrl: thread.extendedData.imageUrl,
          projectUrl: thread.extendedData.projectUrl,
          authorId: thread.creatorId || "",
          authorName: thread.extendedData.authorName || "Anonymous",
          status: thread.extendedData.status || "pending",
          createdAt: thread.createdAt || new Date().toISOString(),
        })
      }
    }

    return threads
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
    const threads: ShowcaseSubmission[] = []

    for await (const report of client.pagination.paginateAll((cursor) =>
      client.reports.list({ cursor, status: "pending", filter: "newest", limit: 50 }),
    )) {
      if (report.type === "showcase_submission" && report.threadId) {
        try {
          const thread = await client.threads.retrieve(report.threadId)
          if (thread.extendedData?.type === "showcase_submission") {
            threads.push({
              id: thread.id,
              title: thread.title,
              description: thread.body || "",
              imageUrl: thread.extendedData.imageUrl,
              projectUrl: thread.extendedData.projectUrl,
              authorId: thread.creatorId || "",
              authorName: thread.extendedData.authorName || "Anonymous",
              status: "pending",
              createdAt: thread.createdAt || new Date().toISOString(),
              reportId: report.id,
            })
          }
        } catch {
          // Thread might have been deleted
        }
      }
    }

    return threads
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

    // Update thread status to approved
    await client.threads.update(threadId, {
      extendedData: {
        status: "approved",
      },
    })

    await client.reports.update(reportId, {
      status: "approved",
    })

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

    // Update thread status to rejected
    await client.threads.update(threadId, {
      extendedData: {
        status: "rejected",
      },
    })

    await client.reports.update(reportId, {
      status: "rejected",
    })

    return { success: true }
  } catch (error) {
    console.error("Failed to reject submission:", error)
    return { success: false, error: "Failed to reject submission" }
  }
}
