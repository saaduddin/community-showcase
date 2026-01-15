"use client"

import { useState, useEffect, useCallback } from "react"
import { SubmissionCard } from "./submission-card"
import { getPendingSubmissions, approveSubmission, rejectSubmission } from "@/app/showcase/actions"
import type { ShowcaseSubmission } from "@/lib/forum-client"
import { Loader2, Inbox } from "lucide-react"

export function AdminPanel() {
  const [submissions, setSubmissions] = useState<ShowcaseSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true)
    const data = await getPendingSubmissions()
    setSubmissions(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadSubmissions()
  }, [loadSubmissions])

  async function handleApprove(threadId: string, reportId: string) {
    const result = await approveSubmission(threadId, reportId)
    if (result.success) {
      setSubmissions((prev) => prev.filter((s) => s.id !== threadId))
    }
  }

  async function handleReject(threadId: string, reportId: string) {
    const result = await rejectSubmission(threadId, reportId)
    if (result.success) {
      setSubmissions((prev) => prev.filter((s) => s.id !== threadId))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Inbox className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h3 className="text-lg font-medium text-foreground">No pending submissions</h3>
        <p className="text-sm text-muted-foreground">All submissions have been reviewed</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {submissions.map((submission) => (
        <SubmissionCard
          key={submission.id}
          submission={submission}
          showActions
          onApprove={handleApprove}
          onReject={handleReject}
        />
      ))}
    </div>
  )
}
