"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Heart, X, Check, Clock, User, Calendar } from "lucide-react"
import type { ShowcaseSubmission } from "@/app/showcase/actions"
import { toggleUpvote } from "@/app/showcase/actions"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

interface SubmissionDetailModalProps {
    submission: ShowcaseSubmission
    isOpen: boolean
    onClose: () => void
    onApprove?: (threadId: string, reportId: string) => void
    onReject?: (threadId: string, reportId: string) => void
}

export function SubmissionDetailModal({
    submission,
    isOpen,
    onClose,
    onApprove,
    onReject,
}: SubmissionDetailModalProps) {
    const [selectedImageIndex, setSelectedImageIndex] = useState(submission.mainImageIndex || 0)
    const [votes, setVotes] = useState(submission.upvotes || 0)
    const [hasVoted, setHasVoted] = useState(false) // Note: In a real app we'd need initial state from server
    const [isVoting, setIsVoting] = useState(false)

    const images = submission.images.length > 0 ? submission.images : [{ url: "", name: "Placeholder" }]

    const statusConfig = {
        pending: { label: "Pending", variant: "secondary" as const, icon: Clock },
        approved: { label: "Approved", variant: "default" as const, icon: Check },
        rejected: { label: "Rejected", variant: "destructive" as const, icon: X },
    }

    const status = statusConfig[submission.status] || statusConfig.pending
    const StatusIcon = status.icon

    async function handleVote() {
        if (isVoting || hasVoted) return
        setIsVoting(true)

        // Optimistic
        setVotes(prev => prev + 1)
        setHasVoted(true)

        const result = await toggleUpvote(submission.id)
        if (!result.success) {
            setVotes(prev => prev - 1)
            setHasVoted(false)
        }
        setIsVoting(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-6xl w-full p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col sm:flex-row">

                {/* Left Column: Media Gallery */}
                <div className="w-full sm:w-1/2 bg-muted/30 p-6 flex flex-col gap-4 border-r border-border/50">
                    {/* Main Image */}
                    <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted border border-border shadow-sm relative group">
                        {images[selectedImageIndex].url ? (
                            <a href={images[selectedImageIndex].url} target="_blank" rel="noreferrer" className="block h-full w-full">
                                <img
                                    src={images[selectedImageIndex].url}
                                    alt={`Screenshot ${selectedImageIndex + 1}`}
                                    className="h-full w-full object-contain bg-black/5"
                                />
                            </a>
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground/20 font-bold text-4xl">
                                {submission.title.charAt(0)}
                            </div>
                        )}
                    </div>

                    {/* Thumbnails */}
                    {images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedImageIndex(idx)}
                                    className={cn(
                                        "relative h-16 w-24 flex-shrink-0 rounded-md overflow-hidden border-2 transition-all",
                                        selectedImageIndex === idx
                                            ? "border-primary ring-2 ring-primary/20"
                                            : "border-transparent opacity-70 hover:opacity-100"
                                    )}
                                >
                                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Column: Details */}
                <div className="w-full sm:w-1/2 flex flex-col h-full max-h-[50vh] sm:max-h-[90vh]">
                    <DialogHeader className="p-6 pb-2">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                                <DialogTitle className="text-2xl font-bold leading-tight">
                                    {submission.title}
                                </DialogTitle>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <User className="h-3.5 w-3.5" />
                                        {submission.authorName}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {format(new Date(submission.createdAt), "MMM d, yyyy")}
                                    </span>
                                </div>
                            </div>
                            <Badge variant={status.variant} className="shrink-0 gap-1.5">
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                            </Badge>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 pt-2">
                        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed">
                            <p className="whitespace-pre-wrap">{submission.description}</p>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 pt-4 border-t border-border/50 bg-muted/10 flex flex-col gap-4">

                        <div className="flex items-center justify-between gap-4">
                            <Button
                                size="lg"
                                variant={hasVoted ? "secondary" : "default"}
                                className={cn(
                                    "flex-1 gap-2 transition-all",
                                    hasVoted && "bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                                )}
                                onClick={handleVote}
                                disabled={isVoting}
                            >
                                <Heart className={cn("h-5 w-5", hasVoted && "fill-current")} />
                                {hasVoted ? "Upvoted" : "Upvote Project"}
                                <span className="ml-1 text-xs opacity-70 bg-black/5 px-2 py-0.5 rounded-full">
                                    {votes}
                                </span>
                            </Button>

                            {submission.projectUrl && (
                                <Button size="lg" variant="outline" className="flex-1 gap-2" asChild>
                                    <a href={submission.projectUrl} target="_blank" rel="noopener noreferrer">
                                        Visit Site
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                </Button>
                            )}
                        </div>

                        {/* Admin Actions */}
                        {onApprove && onReject && submission.reportId && (
                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                                <Button
                                    variant="outline"
                                    className="w-full gap-2 text-green-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                                    onClick={() => onApprove(submission.id, submission.reportId!)}
                                >
                                    <Check className="h-4 w-4" />
                                    Approve
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                                    onClick={() => onReject(submission.id, submission.reportId!)}
                                >
                                    <X className="h-4 w-4" />
                                    Reject
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    )
}
