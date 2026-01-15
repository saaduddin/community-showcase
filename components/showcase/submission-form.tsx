"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createSubmission } from "@/app/showcase/actions"
import { Loader2, Send } from "lucide-react"

interface SubmissionFormProps {
  onSuccess?: () => void
}

export function SubmissionForm({ onSuccess }: SubmissionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    const result = await createSubmission({
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      imageUrl: (formData.get("imageUrl") as string) || undefined,
      projectUrl: (formData.get("projectUrl") as string) || undefined,
    })

    setIsSubmitting(false)

    if (result.success) {
      setSuccess(true)
      ;(e.target as HTMLFormElement).reset()
      onSuccess?.()
    } else {
      setError(result.error || "Something went wrong")
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle>Submit Your Work</CardTitle>
        <CardDescription>
          Share your project with the community. Submissions are reviewed before appearing publicly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Project Title *</Label>
            <Input id="title" name="title" required placeholder="My Awesome Project" className="bg-background" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              name="description"
              required
              placeholder="Tell us about your project..."
              rows={4}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              name="imageUrl"
              type="url"
              placeholder="https://example.com/image.png"
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectUrl">Project URL</Label>
            <Input
              id="projectUrl"
              name="projectUrl"
              type="url"
              placeholder="https://myproject.com"
              className="bg-background"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <p className="text-sm text-green-600">Submitted successfully! Your project will appear after review.</p>
          )}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit for Review
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
