"use client"

import { useState, useEffect, useCallback } from "react"
import { SubmissionCard } from "./submission-card"
import { getMySubmissions } from "@/app/showcase/actions"
import type { ShowcaseSubmission } from "@/app/showcase/actions"
import { Loader2, FolderOpen } from "lucide-react"

export function MySubmissions() {
  const [submissions, setSubmissions] = useState<ShowcaseSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true)
    const data = await getMySubmissions()
    setSubmissions(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadSubmissions()
  }, [loadSubmissions])

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
        <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h3 className="text-lg font-medium text-foreground">No submissions yet</h3>
        <p className="text-sm text-muted-foreground">Submit your first project to get started</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {submissions.map((submission) => (
        <SubmissionCard key={submission.id} submission={submission} showStatus />
      ))}
    </div>
  )
}
