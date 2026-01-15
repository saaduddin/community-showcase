"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink, Check, X, Clock } from "lucide-react"
import type { ShowcaseSubmission } from "@/lib/forum-client"

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
  const statusConfig = {
    pending: { label: "Pending Review", variant: "secondary" as const, icon: Clock },
    approved: { label: "Approved", variant: "default" as const, icon: Check },
    rejected: { label: "Rejected", variant: "destructive" as const, icon: X },
  }

  const status = statusConfig[submission.status]
  const StatusIcon = status.icon

  return (
    <Card className="group overflow-hidden border-border/50 bg-card transition-all hover:border-border hover:shadow-md">
      {submission.imageUrl && (
        <div className="aspect-video w-full overflow-hidden bg-muted">
          <img
            src={submission.imageUrl || "/placeholder.svg"}
            alt={submission.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      {!submission.imageUrl && (
        <div className="flex aspect-video w-full items-center justify-center bg-muted">
          <span className="text-4xl font-bold text-muted-foreground/30">
            {submission.title.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold text-foreground">{submission.title}</h3>
          {showStatus && (
            <Badge variant={status.variant} className="shrink-0 gap-1">
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
          )}
        </div>
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{submission.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">by {submission.authorName}</span>
          {submission.projectUrl && (
            <Button variant="ghost" size="sm" asChild className="h-7 px-2">
              <a href={submission.projectUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-3 w-3" />
                View
              </a>
            </Button>
          )}
        </div>
        {showActions && onApprove && onReject && submission.reportId && (
          <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <Button size="sm" className="flex-1" onClick={() => onApprove(submission.id, submission.reportId!)}>
              <Check className="mr-1 h-4 w-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={() => onReject(submission.id, submission.reportId!)}
            >
              <X className="mr-1 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
