// @vitest-environment jsdom
import { Profiler } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SESSION_EXPIRED_NOTICE } from '../../lib/auth-state'
import { useAuth } from './auth-context'
import { AuthProvider } from './auth-provider'

// Stands in for the many grid tiles that each report an ended session.
function AuthProbe() {
  const { state, markSignedOut } = useAuth()
  const notice = state.status === 'signed-out' ? (state.notice ?? 'none') : ''
  return (
    <>
      <output aria-label="Auth state">
        {state.status} {notice}
      </output>
      <button type="button" onClick={() => markSignedOut(SESSION_EXPIRED_NOTICE)}>
        Session ended
      </button>
      <button type="button" onClick={() => markSignedOut('Another notice')}>
        Other sign out
      </button>
    </>
  )
}

describe('AuthProvider markSignedOut', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('signs out once, with the first notice, however many views report the ended session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(Response.json({ username: 'admin' }))),
    )
    const onCommit = vi.fn()
    render(
      <MemoryRouter>
        <Profiler id="auth" onRender={onCommit}>
          <AuthProvider>
            <AuthProbe />
          </AuthProvider>
        </Profiler>
      </MemoryRouter>,
    )
    await screen.findByText('signed-in')

    // React may render once more to confirm an unchanged state, so counting starts after the second report.
    fireEvent.click(screen.getByRole('button', { name: 'Session ended' }))
    fireEvent.click(screen.getByRole('button', { name: 'Session ended' }))
    const commitsAfterSignOut = onCommit.mock.calls.length
    for (let tile = 0; tile < 5; tile++) {
      fireEvent.click(screen.getByRole('button', { name: 'Session ended' }))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Other sign out' }))

    expect(screen.getByLabelText('Auth state').textContent).toBe(
      `signed-out ${SESSION_EXPIRED_NOTICE}`,
    )
    expect(onCommit).toHaveBeenCalledTimes(commitsAfterSignOut)
  })
})
