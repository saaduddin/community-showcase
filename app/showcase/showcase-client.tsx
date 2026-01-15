"use client"

import { useState, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SubmissionList } from "@/components/showcase/submission-list"
import { SubmissionForm } from "@/components/showcase/submission-form"
import { AuthModal } from "@/components/showcase/auth-modal"
import {
  logoutUser,
  getApprovedSubmissions,
  getMySubmissions,
  getPendingSubmissions,
  approveSubmission,
  rejectSubmission,
} from "./actions"
import { LayoutGrid, PlusCircle, Shield, FolderOpen, LogOut, Sparkles, LogIn, Inbox } from "lucide-react"

interface ShowcaseClientProps {
  user: {
    id: string
    username: string
    displayName?: string | null
    roles?: { id: string; name: string; slug: string }[]
  } | null
  isAdmin: boolean
}

export function ShowcaseClient({ user, isAdmin }: ShowcaseClientProps) {
  const [activeTab, setActiveTab] = useState("gallery")

  async function handleLogout() {
    await logoutUser()
    window.location.reload()
  }

  // Memoized fetch functions to prevent re-renders
  const fetchApproved = useCallback(() => getApprovedSubmissions(), [])
  const fetchMine = useCallback(() => getMySubmissions(), [])
  const fetchPending = useCallback(() => getPendingSubmissions(), [])

  async function handleApprove(threadId: string, reportId: string) {
    await approveSubmission(threadId, reportId)
  }

  async function handleReject(threadId: string, reportId: string) {
    await rejectSubmission(threadId, reportId)
  }

  return (
    <main className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-xl border-border/50 bg-card">
        {/* Header */}
        <div className="border-b border-border/50 bg-muted/10 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Community Showcase</h1>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium leading-none text-foreground">
                  {user.displayName || user.username}
                </span>
                {isAdmin && (
                  <span className="text-[10px] uppercase font-bold text-primary">Admin</span>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign Out</span>
              </Button>
            </div>
          ) : (
            <AuthModal>
              <Button size="sm" className="gap-2 shadow-sm">
                <LogIn className="h-3.5 w-3.5" />
                Sign In
              </Button>
            </AuthModal>
          )}
        </div>

        {/* Navigation & Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-border/50 bg-background/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
            <TabsList className="bg-muted/50 p-1 w-full justify-start overflow-x-auto no-scrollbar">
              <TabsTrigger value="gallery" className="gap-2 px-3">
                <LayoutGrid className="h-3.5 w-3.5" />
                Gallery
              </TabsTrigger>
              {user && (
                <>
                  <TabsTrigger value="submit" className="gap-2 px-3">
                    <PlusCircle className="h-3.5 w-3.5" />
                    Submit
                  </TabsTrigger>
                  <TabsTrigger value="my-submissions" className="gap-2 px-3">
                    <FolderOpen className="h-3.5 w-3.5" />
                    My Stuff
                  </TabsTrigger>
                </>
              )}
              {isAdmin && (
                <TabsTrigger value="admin" className="gap-2 px-3">
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <TabsContent value="gallery" className="mt-0 space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Featured Work</h2>
                  <p className="text-sm text-muted-foreground">Discover what others are building</p>
                </div>
                <SubmissionList
                  fetchSubmissions={fetchApproved}
                  emptyIcon={<Sparkles className="h-12 w-12 text-muted-foreground/50" />}
                  emptyTitle="No projects yet"
                  emptyMessage="Be the first to submit your work"
                  showSearch
                />
              </TabsContent>

              {user ? (
                <>
                  <TabsContent value="submit" className="mt-0 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                    <div className="mx-auto max-w-xl space-y-6">
                      <div className="text-center">
                        <h2 className="text-xl font-semibold tracking-tight">Share Your Project</h2>
                        <p className="text-sm text-muted-foreground">Submit for review to be featured in the gallery</p>
                      </div>
                      <SubmissionForm onSuccess={() => setActiveTab("my-submissions")} />
                    </div>
                  </TabsContent>

                  <TabsContent value="my-submissions" className="mt-0 space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">My Submissions</h2>
                      <p className="text-sm text-muted-foreground">Manage and track your projects</p>
                    </div>
                    <SubmissionList
                      fetchSubmissions={fetchMine}
                      emptyIcon={<FolderOpen className="h-12 w-12 text-muted-foreground/50" />}
                      emptyTitle="No submissions yet"
                      emptyMessage="Submit your first project to get started"
                      showStatus
                    />
                  </TabsContent>
                </>
              ) : (
                activeTab === "gallery" && (
                  <div className="mt-12 rounded-xl border border-dashed border-border p-8 text-center bg-muted/20">
                    <h3 className="text-lg font-medium">Have something to share?</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Join the community to showcase your work.
                    </p>
                    <AuthModal>
                      <Button variant="outline" size="sm">
                        Sign In or Register
                      </Button>
                    </AuthModal>
                  </div>
                )
              )}

              {isAdmin && (
                <TabsContent value="admin" className="mt-0 space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Admin Review</h2>
                    <p className="text-sm text-muted-foreground">Review pending submissions</p>
                  </div>
                  <SubmissionList
                    fetchSubmissions={fetchPending}
                    emptyIcon={<Inbox className="h-12 w-12 text-muted-foreground/50" />}
                    emptyTitle="No pending submissions"
                    emptyMessage="All submissions have been reviewed"
                    showActions
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                </TabsContent>
              )}
            </div>
          </div>
        </Tabs>
      </Card>
    </main>
  )
}
