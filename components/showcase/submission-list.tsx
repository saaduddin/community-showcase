"use client"

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { SubmissionCard } from "./submission-card"
import type { ShowcaseSubmission } from "@/app/showcase/actions"
import { Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

interface SubmissionListProps {
    fetchSubmissions: () => Promise<ShowcaseSubmission[]>
    emptyIcon: ReactNode
    emptyTitle: string
    emptyMessage: string
    showSearch?: boolean
    showStatus?: boolean
    showActions?: boolean
    onApprove?: (threadId: string, reportId: string) => Promise<void>
    onReject?: (threadId: string, reportId: string) => Promise<void>
}

export function SubmissionList({
    fetchSubmissions,
    emptyIcon,
    emptyTitle,
    emptyMessage,
    showSearch = false,
    showStatus = false,
    showActions = false,
    onApprove,
    onReject,
}: SubmissionListProps) {
    const [submissions, setSubmissions] = useState<ShowcaseSubmission[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")

    const loadSubmissions = useCallback(async () => {
        setIsLoading(true)
        const data = await fetchSubmissions()
        setSubmissions(data)
        setIsLoading(false)
    }, [fetchSubmissions])

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

    async function handleApprove(threadId: string, reportId: string) {
        if (!onApprove) return
        await onApprove(threadId, reportId)
        setSubmissions((prev) => prev.filter((s) => s.id !== threadId))
    }

    async function handleReject(threadId: string, reportId: string) {
        if (!onReject) return
        await onReject(threadId, reportId)
        setSubmissions((prev) => prev.filter((s) => s.id !== threadId))
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    const displayItems = showSearch ? filteredSubmissions : submissions

    if (displayItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4">{emptyIcon}</div>
                <h3 className="text-lg font-medium text-foreground">{emptyTitle}</h3>
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {showSearch && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search projects, authors..."
                        className="pl-9 bg-background/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {displayItems.map((submission) => (
                    <SubmissionCard
                        key={submission.id}
                        submission={submission}
                        showStatus={showStatus}
                        showActions={showActions}
                        onApprove={showActions ? handleApprove : undefined}
                        onReject={showActions ? handleReject : undefined}
                    />
                ))}
            </div>
        </div>
    )
}
