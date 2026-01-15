import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, Check, X, Clock, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { toggleUpvote } from "@/app/showcase/actions"
import type { ShowcaseSubmission } from "@/app/showcase/actions"
import { SubmissionDetailModal } from "./submission-detail-modal"

interface SubmissionCardProps {
  submission: ShowcaseSubmission
  showStatus?: boolean
  showActions?: boolean
  onApprove?: (threadId: string, reportId: string) => void
  onReject?: (threadId: string, reportId: string) => void
}

export function SubmissionCard({
  submission,
  showStatus = false,
  showActions = false,
  onApprove,
  onReject,
}: SubmissionCardProps) {
  const [votes, setVotes] = useState(submission.upvotes || 0)
  const [hasVoted, setHasVoted] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const statusConfig = {
    pending: { label: "Pending", variant: "secondary" as const, icon: Clock },
    approved: { label: "Approved", variant: "default" as const, icon: Check },
    rejected: { label: "Rejected", variant: "destructive" as const, icon: X },
  }

  const status = statusConfig[submission.status] || statusConfig.pending
  const StatusIcon = status.icon

  async function handleVote(e?: React.MouseEvent) {
    e?.stopPropagation()
    if (isVoting || hasVoted) return
    setIsVoting(true)

    // Optimistic update
    setVotes(prev => prev + 1)
    setHasVoted(true)

    const result = await toggleUpvote(submission.id)
    if (!result.success) {
      // Revert if failed
      setVotes(prev => prev - 1)
      setHasVoted(false)
    }
    setIsVoting(false)
  }

  function handleCardClick(e: React.MouseEvent) {
    // Don't open if clicking a button or link
    if ((e.target as HTMLElement).closest("button, a")) return
    setIsModalOpen(true)
  }

  return (
    <>
      <Card
        className="group relative overflow-hidden transition-all hover:shadow-md border-border/50 bg-card cursor-pointer"
        onClick={handleCardClick}
      >
        {/* Image / Thumbnail */}
        <div className="aspect-[16/9] w-full overflow-hidden bg-muted relative">
          {submission.images.length > 0 ? (
            <img
              src={submission.images[submission.mainImageIndex]?.url || submission.images[0].url}
              alt={submission.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted/50">
              <span className="text-4xl font-bold text-muted-foreground/20">
                {submission.title.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Overlay Actions */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {submission.projectUrl && (
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 shadow-sm backdrop-blur-sm bg-background/80 hover:bg-background"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <a href={submission.projectUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-3">
          {/* Title & Status */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-medium truncate text-sm text-foreground" title={submission.title}>
              {submission.title}
            </h3>
            {showStatus && (
              <Badge variant={status.variant} className="h-5 px-1.5 text-[10px] gap-0.5">
                <StatusIcon className="h-2.5 w-2.5" />
                {status.label}
              </Badge>
            )}
          </div>

          {/* Author */}
          <div className="text-xs text-muted-foreground mb-3">
            by {submission.authorName}
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2.5em]">
            {submission.description}
          </p>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-border/50 pt-2 mt-auto">
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 px-2 text-xs gap-1.5 hover:bg-red-50 hover:text-red-500", hasVoted && "text-red-500 bg-red-50")}
              onClick={handleVote}
              disabled={isVoting}
            >
              <Heart className={cn("h-3.5 w-3.5", hasVoted && "fill-current")} />
              {votes}
            </Button>

            {showActions && onApprove && onReject && submission.reportId && (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button size="icon" variant="outline" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => onApprove(submission.id, submission.reportId!)}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="outline" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onReject(submission.id, submission.reportId!)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <SubmissionDetailModal
        submission={submission}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApprove={onApprove}
        onReject={onReject}
      />
    </>
  )
}
