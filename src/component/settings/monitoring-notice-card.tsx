import { useFormContext, useWatch } from 'react-hook-form'
import type { SettingsFormValues } from '../../lib/settings-schemas'
import { Checkbox } from '../ui/choice'
import { Field, TextArea } from '../ui/field'
import { SettingsCard } from './settings-card'

export function MonitoringNoticeCard() {
  const { register, control, formState: { errors } } = useFormContext<SettingsFormValues>()
  const isNoticeEnabled = useWatch({ control, name: 'isNoticeEnabled' })
  const noticeError = errors.noticeText?.message

  return (
    <SettingsCard title="Monitoring notice">
      <label className="flex items-center gap-2 font-semibold">
        <Checkbox {...register('isNoticeEnabled')} />
        Show the notice on the client login screen
      </label>
      <Field
        label="Notice text"
        htmlFor="settings-notice-text"
        message={noticeError}
        isError={noticeError !== undefined}
      >
        <TextArea
          id="settings-notice-text"
          rows={3}
          className="resize-y"
          disabled={!isNoticeEnabled}
          hasError={noticeError !== undefined}
          aria-describedby={noticeError ? 'settings-notice-text-message' : undefined}
          {...register('noticeText')}
        />
      </Field>
    </SettingsCard>
  )
}
