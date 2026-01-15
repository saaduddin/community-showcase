"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { SubmissionCard } from "./submission-card"
import { getApprovedSubmissions } from "@/app/showcase/actions"
import type { ShowcaseSubmission } from "@/app/showcase/actions"
import { Loader2, Sparkles, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export function PublicGallery() {
  const [submissions, setSubmissions] = useState<ShowcaseSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true)
    const data = await getApprovedSubmissions()
    setSubmissions(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadSubmissions()
  }, [loadSubmissions])

  const filteredSubmissions = useMemo(() => {
    if (!searchTerm) return submissions
    const lower = searchTerm.toLowerCase()
    return submissions.filter(
      (s) =>
        s.title.toLowerCase().includes(lower) ||
        s.description.toLowerCase().includes(lower) ||
        s.authorName.toLowerCase().includes(lower)
    )
  }, [submissions, searchTerm])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects, authors..."
          className="pl-9 bg-background/50"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredSubmissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Sparkles className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium text-foreground">No matching projects</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search terms</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSubmissions.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </div>
  )
}
