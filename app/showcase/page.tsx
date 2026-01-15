import { Suspense } from "react"
import { getCurrentUser, isUserAdmin } from "./actions"
import { ShowcaseClient } from "./showcase-client"
import { Loader2 } from "lucide-react"

export const metadata = {
  title: "Community Showcase",
  description: "Discover and share amazing projects built by our community",
}

async function ShowcaseContent() {
  const user = await getCurrentUser()
  const isAdmin = await isUserAdmin()

  return <ShowcaseClient user={user} isAdmin={isAdmin} />
}

export default function ShowcasePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ShowcaseContent />
    </Suspense>
  )
}
