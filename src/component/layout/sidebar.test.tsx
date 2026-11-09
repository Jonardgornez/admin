// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loginRequestListsBody,
  makeLoginRequest,
} from '../../test/login-request-fixtures'
import { TestProviders } from '../../test/test-providers'
import { Sidebar } from './sidebar'

function stubPendingRequests(pendingCount: number) {
  const fetchMock = vi.fn<typeof fetch>(() =>
    Promise.resolve(
      Response.json(
        loginRequestListsBody(
          Array.from({ length: pendingCount }, (_, index) => makeLoginRequest(index + 1)),
        ),
      ),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderSidebar() {
  return render(
    <TestProviders>
      <Sidebar />
    </TestProviders>,
  )
}

describe('Sidebar', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the pending count on the login requests link', async () => {
    stubPendingRequests(3)
    renderSidebar()

    const link = await screen.findByRole('link', { name: 'Login requests, 3 pending' })
    const visibleCount = within(link).getByText('3')
    expect(visibleCount.getAttribute('aria-hidden')).toBe('true')
  })

  it('hides the count when no requests are pending', async () => {
    const fetchMock = stubPendingRequests(0)
    renderSidebar()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))

    expect(screen.getByRole('link', { name: 'Login requests' })).toBeTruthy()
    expect(screen.queryByText('0')).toBeNull()
  })
})
