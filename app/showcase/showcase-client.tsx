"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { PublicGallery } from "@/components/showcase/public-gallery"
import { SubmissionForm } from "@/components/showcase/submission-form"
import { AuthModal } from "@/components/showcase/auth-modal"
import { AdminPanel } from "@/components/showcase/admin-panel"
import { MySubmissions } from "@/components/showcase/my-submissions"
import { logoutUser } from "./actions"
import { LayoutGrid, PlusCircle, Shield, FolderOpen, LogOut, Sparkles, LogIn } from "lucide-react"

interface ShowcaseClientProps {
  user: { id: string; username: string; displayName?: string; roles?: string[] } | null
  isAdmin: boolean
}

export function ShowcaseClient({ user, isAdmin }: ShowcaseClientProps) {
  const [activeTab, setActiveTab] = useState("gallery")

  async function handleLogout() {
    await logoutUser()
    window.location.reload()
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground">
              <Sparkles className="h-5 w-5 text-background" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Community Showcase</h1>
              <p className="hidden text-sm text-muted-foreground sm:block">Discover amazing projects</p>
            </div>
          </div>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.displayName || user.username}
                {isAdmin && (
                  <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                    Admin
                  </span>
                )}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          ) : (
            <AuthModal>
              <Button variant="outline" size="sm">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            </AuthModal>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="inline-flex h-auto flex-wrap gap-1 bg-muted/50 p-1">
            <TabsTrigger value="gallery" className="gap-2 px-4 py-2">
              <LayoutGrid className="h-4 w-4" />
              Gallery
            </TabsTrigger>
            {user && (
              <>
                <TabsTrigger value="submit" className="gap-2 px-4 py-2">
                  <PlusCircle className="h-4 w-4" />
                  Submit
                </TabsTrigger>
                <TabsTrigger value="my-submissions" className="gap-2 px-4 py-2">
                  <FolderOpen className="h-4 w-4" />
                  My Submissions
                </TabsTrigger>
              </>
            )}
            {isAdmin && (
              <TabsTrigger value="admin" className="gap-2 px-4 py-2">
                <Shield className="h-4 w-4" />
                Admin
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="gallery" className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Featured Work</h2>
              <p className="text-muted-foreground">Explore projects submitted by our community members</p>
            </div>
            <PublicGallery />
          </TabsContent>

          {user ? (
            <>
              <TabsContent value="submit" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">Share Your Work</h2>
                  <p className="text-muted-foreground">Submit your project for review by our team</p>
                </div>
                <div className="mx-auto max-w-2xl">
                  <SubmissionForm onSuccess={() => setActiveTab("my-submissions")} />
                </div>
              </TabsContent>

              <TabsContent value="my-submissions" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">My Submissions</h2>
                  <p className="text-muted-foreground">Track the status of your submitted projects</p>
                </div>
                <MySubmissions />
              </TabsContent>
            </>
          ) : (
            activeTab === "gallery" && (
              <div className="mt-8 rounded-lg border border-border/50 bg-card p-8 text-center">
                <h3 className="text-xl font-semibold text-foreground">Want to showcase your work?</h3>
                <p className="mb-6 mt-2 text-muted-foreground">
                  Sign in to submit your projects and join our community
                </p>
                <AuthModal>
                  <Button size="lg">
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign in to submit your own work
                  </Button>
                </AuthModal>
              </div>
            )
          )}

          {isAdmin && (
            <TabsContent value="admin" className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Admin Review</h2>
                <p className="text-muted-foreground">Review and moderate community submissions</p>
              </div>
              <AdminPanel />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </main>
  )
}
