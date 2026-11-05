import { useId, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import {
  addAccountSchema,
  editAccountSchema,
  PASSWORD_RULE_TEXT,
  type AccountFormValues,
} from '../../lib/account-schemas'
import type { AccountPayload } from '../../lib/accounts-api'
import {
  buildAccountPayload,
  getDefaultTimeFields,
  NEW_ACCOUNT_DEFAULT_TIME,
} from '../../lib/accounts'
import type { ApiResult } from '../../lib/api'
import { isSessionExpired } from '../../lib/auth-state'
import type { Account } from '../../types'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Field, TextInput } from '../ui/field'
import { Modal } from '../ui/modal'
import { TimeChoiceFields } from '../ui/time-choice-fields'

const USERNAME_TAKEN_STATUS = 409

interface AccountFormDialogProps {
  account?: Account
  onSave: (payload: AccountPayload) => Promise<ApiResult<Account>>
  onCancel: () => void
}

export function AccountFormDialog({ account, onSave, onCancel }: AccountFormDialogProps) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const usernameId = `${baseId}-username`
  const passwordId = `${baseId}-password`
  const isEditing = account !== undefined
  const isSubmittingRef = useRef(false)

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    trigger,
    control,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(isEditing ? editAccountSchema : addAccountSchema),
    defaultValues: {
      username: account?.username ?? '',
      password: '',
      ...getDefaultTimeFields(account?.defaultTime ?? NEW_ACCOUNT_DEFAULT_TIME),
    },
  })
  const [timeMode, timeAmount, timeUnit] = useWatch({
    control,
    name: ['timeMode', 'timeAmount', 'timeUnit'],
  })

  // After a failed submit, re-check so the amount error clears once it is corrected.
  function recheckAmount() {
    if (isSubmitted) void trigger('timeAmount')
  }

  function changeTimeMode(value: AccountFormValues['timeMode']) {
    setValue('timeMode', value, { shouldDirty: true })
    recheckAmount()
  }

  function changeTimeAmount(value: string) {
    setValue('timeAmount', value, { shouldDirty: true })
    recheckAmount()
  }

  function changeTimeUnit(value: AccountFormValues['timeUnit']) {
    setValue('timeUnit', value, { shouldDirty: true })
    recheckAmount()
  }

  async function saveAccount(values: AccountFormValues) {
    if (isSubmittingRef.current) return
    const payload = buildAccountPayload(values)
    if (payload === null) return
    isSubmittingRef.current = true
    try {
      const result = await onSave(payload)
      if (result.success || isSessionExpired(result)) return
      if (result.status === USERNAME_TAKEN_STATUS) {
        setError('username', { message: result.error })
      } else {
        setError('root', { message: result.error })
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  function closeUnlessSaving() {
    if (!isSubmitting) onCancel()
  }

  const passwordHelp = isEditing
    ? `Leave blank to keep the current password. Otherwise ${PASSWORD_RULE_TEXT}`
    : PASSWORD_RULE_TEXT
  const idleLabel = isEditing ? 'Save changes' : 'Add account'
  const savingLabel = isEditing ? 'Saving...' : 'Adding...'

  return (
    <Modal isOpen labelledBy={titleId} onClose={closeUnlessSaving}>
      <form noValidate onSubmit={(event) => handleSubmit(saveAccount)(event)}>
        <h2 id={titleId} className="m-0 mb-2 text-xl font-semibold">
          {isEditing ? `Edit ${account.username}` : 'Add account'}
        </h2>
        <div className="mb-6 flex flex-col gap-4">
          {errors.root && (
            <Banner variant="danger" icon="alert" role="alert">
              {errors.root.message}
            </Banner>
          )}
          <Field
            label="Username"
            htmlFor={usernameId}
            message={errors.username?.message}
            isError={Boolean(errors.username)}
          >
            <TextInput
              id={usernameId}
              isMono
              autoComplete="off"
              hasError={Boolean(errors.username)}
              aria-describedby={errors.username ? `${usernameId}-message` : undefined}
              {...register('username')}
            />
          </Field>
          <Field
            label={isEditing ? 'New password (optional)' : 'Password'}
            htmlFor={passwordId}
            message={errors.password?.message ?? passwordHelp}
            isError={Boolean(errors.password)}
          >
            <TextInput
              id={passwordId}
              type="password"
              autoComplete="new-password"
              hasError={Boolean(errors.password)}
              aria-describedby={`${passwordId}-message`}
              {...register('password')}
            />
          </Field>
          <TimeChoiceFields
            legend="Default time"
            timeLimitLabel="Time limit"
            timeMode={timeMode}
            amount={timeAmount}
            timeUnit={timeUnit}
            amountError={errors.timeAmount?.message}
            onTimeModeChange={changeTimeMode}
            onAmountChange={changeTimeAmount}
            onTimeUnitChange={changeTimeUnit}
          />
          {isEditing && (
            <p className="m-0 text-xs text-ink-muted">
              A new default time applies from the user's next login.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? savingLabel : idleLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
