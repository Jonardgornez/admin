import { describe, expect, it } from 'vitest'
import { pcs } from '../data/pcs'
import { getPcConfirmation } from './pc-confirmation'

const SAVED_COUNTDOWN = 30

describe('getPcConfirmation', () => {
  it('uses the design wording for a shutdown of a PC with a user', () => {
    expect(getPcConfirmation({ kind: 'shutdown', pcName: 'PC-05' }, pcs, SAVED_COUNTDOWN)).toEqual({
      title: 'Shut down PC-05?',
      body: 'PC-05 has a user signed in (lab-pc05). The client shows a 30-second countdown before it shuts down. Unsaved work on that PC may be lost.',
      confirmLabel: 'Shut down',
    })
  })

  it('does not warn about lost work when no user is signed in', () => {
    const { body } = getPcConfirmation({ kind: 'shutdown', pcName: 'PC-02' }, pcs, SAVED_COUNTDOWN)
    expect(body).toContain('No user is signed in on PC-02')
    expect(body).not.toContain('Unsaved work')
  })

  it('describes a reboot of a PC with a user, including the logout', () => {
    expect(getPcConfirmation({ kind: 'reboot', pcName: 'PC-05' }, pcs, SAVED_COUNTDOWN)).toEqual({
      title: 'Reboot PC-05?',
      body: 'PC-05 has a user signed in (lab-pc05). The client shows a 30-second countdown before it restarts. Unsaved work on that PC may be lost, and the student is logged out.',
      confirmLabel: 'Reboot',
    })
  })

  it('does not warn about lost work or a logout when a reboot has no user', () => {
    expect(getPcConfirmation({ kind: 'reboot', pcName: 'PC-02' }, pcs, SAVED_COUNTDOWN).body).toBe(
      'No user is signed in on PC-02, so no work should be lost. The client shows a 30-second countdown before it restarts.',
    )
  })

  it('summarizes several PCs and counts signed-in users', () => {
    const result = getPcConfirmation(
      { kind: 'shutdown-selected', pcNames: ['PC-01', 'PC-02', 'PC-05'] },
      pcs,
      SAVED_COUNTDOWN,
    )
    expect(result.title).toBe('Shut down 3 PCs?')
    expect(result.body).toContain('2 of them have a user signed in')
  })

  it('handles several PCs with nobody signed in', () => {
    const result = getPcConfirmation(
      { kind: 'shutdown-selected', pcNames: ['PC-02', 'PC-06'] },
      pcs,
      SAVED_COUNTDOWN,
    )
    expect(result.body).toContain('No user is signed in on these PCs')
  })

  it('handles exactly one signed-in user among several PCs', () => {
    const result = getPcConfirmation(
      { kind: 'shutdown-selected', pcNames: ['PC-01', 'PC-02'] },
      pcs,
      SAVED_COUNTDOWN,
    )
    expect(result.body).toContain('1 of them has a user signed in')
  })

  it('falls back to the single-PC wording for a one-PC selection', () => {
    const result = getPcConfirmation(
      { kind: 'shutdown-selected', pcNames: ['PC-05'] },
      pcs,
      SAVED_COUNTDOWN,
    )
    expect(result.title).toBe('Shut down PC-05?')
  })

  it('summarizes several PCs for a reboot with the restart and logout wording', () => {
    const result = getPcConfirmation(
      { kind: 'reboot-selected', pcNames: ['PC-01', 'PC-02', 'PC-05'] },
      pcs,
      SAVED_COUNTDOWN,
    )
    expect(result).toEqual({
      title: 'Reboot 3 PCs?',
      body: '2 of them have a user signed in. The clients show a 30-second countdown before they restart. Unsaved work on those PCs may be lost, and signed-in students are logged out.',
      confirmLabel: 'Reboot',
    })
  })

  it('handles several PCs being restarted with nobody signed in', () => {
    const result = getPcConfirmation(
      { kind: 'reboot-selected', pcNames: ['PC-02', 'PC-06'] },
      pcs,
      SAVED_COUNTDOWN,
    )
    expect(result.body).toBe(
      'No user is signed in on these PCs, so no work should be lost. The clients show a 30-second countdown before they restart.',
    )
  })

  it('handles exactly one signed-in user among several PCs being restarted', () => {
    const result = getPcConfirmation(
      { kind: 'reboot-selected', pcNames: ['PC-01', 'PC-02'] },
      pcs,
      SAVED_COUNTDOWN,
    )
    expect(result.body).toContain('1 of them has a user signed in')
  })

  it('falls back to the single-PC reboot wording for a one-PC reboot selection', () => {
    const result = getPcConfirmation({ kind: 'reboot-selected', pcNames: ['PC-05'] }, pcs, SAVED_COUNTDOWN)
    expect(result.title).toBe('Reboot PC-05?')
    expect(result.body).toContain('and the student is logged out.')
  })

  describe('countdown wording', () => {
    it('states the saved countdown in seconds', () => {
      const { body } = getPcConfirmation({ kind: 'shutdown', pcName: 'PC-02' }, pcs, 45)
      expect(body).toContain('The client shows a 45-second countdown before it shuts down.')
    })

    it('says a countdown without a number when the saved setting is unknown', () => {
      const { body } = getPcConfirmation({ kind: 'shutdown', pcName: 'PC-02' }, pcs, null)
      expect(body).toBe(
        'No user is signed in on PC-02, so no work should be lost. The client shows a countdown before it shuts down.',
      )
    })

    it('uses the same countdown wording for several PCs', () => {
      const { body } = getPcConfirmation(
        { kind: 'reboot-selected', pcNames: ['PC-02', 'PC-06'] },
        pcs,
        45,
      )
      expect(body).toContain('The clients show a 45-second countdown before they restart.')
    })

    it('says a countdown without a number for several PCs when the setting is unknown', () => {
      const { body } = getPcConfirmation(
        { kind: 'shutdown-selected', pcNames: ['PC-02', 'PC-06'] },
        pcs,
        null,
      )
      expect(body).toContain('The clients show a countdown before they shut down.')
    })

    it.each([
      [5, 'a'],
      [8, 'an'],
      [11, 'an'],
      [18, 'an'],
      [30, 'a'],
      [80, 'an'],
      [85, 'an'],
      [90, 'a'],
      [110, 'a'],
      [800, 'an'],
      [1800, 'an'],
      [3600, 'a'],
    ])('uses the article for %i seconds that fits the spoken number', (seconds, article) => {
      const { body } = getPcConfirmation({ kind: 'shutdown', pcName: 'PC-02' }, pcs, seconds)
      expect(body).toContain(`The client shows ${article} ${seconds}-second countdown`)
    })
  })
})
