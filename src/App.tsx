import { createBrowserRouter, Outlet, RouterProvider } from 'react-router'
import { AuthProvider } from './component/auth/auth-provider'
import { RequireAuth } from './component/auth/require-auth'
import { AppShell } from './component/layout/app-shell'
import { AccountsPage } from './pages/accounts-page'
import { DashboardPage } from './pages/dashboard-page'
import { LogsPage } from './pages/logs-page'
import { NotFoundPage } from './pages/not-found-page'
import { RequestsPage } from './pages/requests-page'
import { SettingsPage } from './pages/settings-page'
import { SignInPage } from './pages/sign-in-page'
import { ViewScreenPage } from './pages/view-screen-page'

const router = createBrowserRouter([
  {
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    children: [
      { path: '/', element: <SignInPage /> },
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/pc/:pcId/screen', element: <ViewScreenPage /> },
          { path: '/accounts', element: <AccountsPage /> },
          { path: '/requests', element: <RequestsPage /> },
          { path: '/logs', element: <LogsPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
