import { useCallback, useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import { FALLBACK_SETTINGS } from '../../lib/settings'
import { getSettings, saveSettings, type AppSettings } from '../../lib/settings-api'
import {
  buildSettingsPayload,
  settingsFormSchema,
  toSettingsFormValues,
  type SettingsFormValues,
} from '../../lib/settings-schemas'
import { useSessionRequest } from '../auth/use-session-request'
import { useNotify } from '../ui/notification-context'

export const SETTINGS_SAVED_MESSAGE = 'Settings saved.'

export type SettingsLoadState =
  | { status: 'loading' }
  | { status: 'loaded' }
  | { status: 'error'; error: string }

// One form for the settings that load from the server. The page's Save button submits it.
export function useSettingsEditor() {
  const request = useSessionRequest()
  const notify = useNotify()
  const [loadState, setLoadState] = useState<SettingsLoadState>({ status: 'loading' })
  const isSavingRef = useRef(false)
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: toSettingsFormValues(FALLBACK_SETTINGS),
  })
  const { reset, setError } = form

  const applyLoadResult = useCallback(
    (result: ApiResult<AppSettings>) => {
      if (result.success) {
        reset(toSettingsFormValues(result.data))
        setLoadState({ status: 'loaded' })
      } else if (!isSessionExpired(result)) {
        setLoadState({ status: 'error', error: result.error })
      }
    },
    [reset],
  )

  const load = useCallback(
    () => request(getSettings()).then(applyLoadResult),
    [request, applyLoadResult],
  )

  useEffect(() => {
    void load()
  }, [load])

  const retry = useCallback(() => {
    setLoadState({ status: 'loading' })
    void load()
  }, [load])

  async function saveSettingsForm(values: SettingsFormValues) {
    if (isSavingRef.current) return
    const settings = buildSettingsPayload(values)
    if (settings === null) return
    isSavingRef.current = true
    try {
      const result = await request(saveSettings(settings))
      if (result.success) {
        reset(toSettingsFormValues(result.data))
        notify(SETTINGS_SAVED_MESSAGE)
      } else if (!isSessionExpired(result)) {
        // Input stays as the admin typed it, so they can fix it and save again.
        setError('root', { message: result.error })
      }
    } finally {
      isSavingRef.current = false
    }
  }

  return {
    form,
    loadState,
    isLoaded: loadState.status === 'loaded',
    isSaving: form.formState.isSubmitting,
    retry,
    saveSettingsForm,
  }
}
