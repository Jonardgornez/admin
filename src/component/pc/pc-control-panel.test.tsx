// @vitest-environment jsdom
import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CONTROL_OFF_STATE, type RemoteControlState } from '../../lib/remote-control'
import type { Pc, ViewMode } from '../../types'
import { PcControlPanel } from './pc-control-panel'

const pc: Pc = { name: 'PC-01', status: 'locked', lastSeen: 'Now' }

function renderPanel(viewMode: ViewMode, control: RemoteControlState) {
  render(
    <PcControlPanel
      pc={pc}
      viewMode={viewMode}
      control={control}
      takeControlBlockMessage={null}
      isCoolingDown={false}
      stopButtonRef={createRef<HTMLButtonElement>()}
      onStartControl={vi.fn()}
      onStopControl={vi.fn()}
    />,
  )
}

describe('PcControlPanel', () => {
  it('says the user is notified in Notified view', () => {
    renderPanel('notified', CONTROL_OFF_STATE)
    expect(screen.getByText(/The user is notified/)).toBeTruthy()
  })

  it('says Anonymous view shows nothing on the PC', () => {
    renderPanel('anonymous', CONTROL_OFF_STATE)
    expect(screen.getByText(/Anonymous view shows nothing on the PC/)).toBeTruthy()
  })

  it('names the controlling notice while controlling in Notified view', () => {
    renderPanel('notified', { kind: 'on' })
    expect(screen.getAllByText(/The administrator is controlling this PC/).length).toBeGreaterThan(0)
  })

  it('says no notice is shown while controlling in Anonymous view', () => {
    renderPanel('anonymous', { kind: 'on' })
    expect(screen.getAllByText(/It shows no notice/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/The administrator is controlling this PC/)).toBeNull()
  })
})
