// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '../../lib/api'
import { makeLoginRequest } from '../../test/login-request-fixtures'
import { RequestCard } from './request-card'

type RequestCardProps = ComponentProps<typeof RequestCard>

const EXPIRED_MESSAGE = 'This request expired. Ask the student to request again.'
const NOW = new Date('2026-11-05T10:05:00.000Z')
const LATER = new Date('2026-11-05T10:08:00.000Z')

function makeProps(overrides: Partial<RequestCardProps> = {}): RequestCardProps {
  return {
    request: makeLoginRequest(7),
    now: NOW,
    isBusy: false,
    defaultApproval: { mode: 'time-limit', minutes: 60 },
    onApprove: vi.fn(() => Promise.resolve<ApiResult<unknown>>({ success: true, data: undefined })),
    onDeny: vi.fn(),
    ...overrides,
  }
}

function minutesInput() {
  return screen.getByLabelText('Minutes for PC-07')
}

describe('RequestCard', () => {
  it('shows the server message as an alert when approval is refused as expired', async () => {
    const onApprove = vi.fn(() =>
      Promise.resolve<ApiResult<unknown>>({ success: false, status: 409, error: EXPIRED_MESSAGE }),
    )
    render(<RequestCard {...makeProps({ onApprove })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    const alert = await within(screen.getByRole('article')).findByRole('alert')
    expect(alert.textContent).toBe(EXPIRED_MESSAGE)
    expect(onApprove).toHaveBeenCalledWith({ mode: 'time-limit', minutes: 60 })
  })

  it('keeps the minutes the admin typed when the list data changes', () => {
    const props = makeProps()
    const { rerender } = render(<RequestCard {...props} />)

    fireEvent.change(minutesInput(), { target: { value: '45' } })
    rerender(
      <RequestCard
        {...props}
        request={makeLoginRequest(7, { requestedAt: '2026-11-05T10:03:00.000Z' })}
        now={LATER}
      />,
    )

    expect((minutesInput() as HTMLInputElement).value).toBe('45')
  })
})
