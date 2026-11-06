import { useEffect, useState } from 'react'
import {
  FALLBACK_CONSOLE_DEFAULTS,
  toConsoleDefaults,
  type ConsoleDefaults,
} from '../../lib/settings'
import { getSettings } from '../../lib/settings-api'
import { useSessionRequest } from '../auth/use-session-request'

interface ConsoleDefaultsState {
  isLoaded: boolean
  defaults: ConsoleDefaults
}

// Reads the saved defaults that pre-fill forms. Falls back to today's values if they fail to load.
export function useConsoleDefaults(): ConsoleDefaultsState {
  const request = useSessionRequest()
  const [state, setState] = useState<ConsoleDefaultsState>({
    isLoaded: false,
    defaults: FALLBACK_CONSOLE_DEFAULTS,
  })

  useEffect(() => {
    let isCurrent = true
    void request(getSettings()).then((result) => {
      if (isCurrent) setState({ isLoaded: true, defaults: toConsoleDefaults(result) })
    })
    return () => {
      isCurrent = false
    }
  }, [request])

  return state
}
