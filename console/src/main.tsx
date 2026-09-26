import './index.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { onLangChange } from '@/i18n'
import { setUnauthorizedHandler } from '@/lib/api'
import { createQueryClient } from '@/lib/query'
import { createAppRouter } from '@/router'

const queryClient = createQueryClient()
const router = createAppRouter(queryClient)

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Any 401 from the API (expired or revoked session) sends the user back to the login page.
setUnauthorizedHandler(() => {
  queryClient.removeQueries({ queryKey: ['me'] })
  const { pathname, href } = router.state.location
  if (pathname === '/login') return
  queryClient.cancelQueries()
  void router.navigate({ to: '/login', search: { redirect: href }, replace: true })
})

// Refetch after a language switch: error messages and other gateway-made text are localized server-side.
onLangChange(() => void queryClient.invalidateQueries())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
