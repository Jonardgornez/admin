import { useId, useState, type ChangeEvent, type SubmitEvent } from 'react'
import { validateAccountForm } from '../../lib/accounts'
import type { Account, AccountDetails, AccountFormErrors, AccountFormValues } from '../../types'
import { Button } from '../ui/button'
import { Field, TextInput } from '../ui/field'
import { Modal } from '../ui/modal'

interface AccountFormDialogProps {
  account?: Account
  accounts: Account[]
  onSave: (details: AccountDetails) => void
  onCancel: () => void
}

export function AccountFormDialog({
  account,
  accounts,
  onSave,
  onCancel,
}: AccountFormDialogProps) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const usernameId = `${baseId}-username`
  const passwordId = `${baseId}-password`
  const isEditing = account !== undefined

  const [values, setValues] = useState<AccountFormValues>({
    username: account?.username ?? '',
    password: '',
  })
  const [errors, setErrors] = useState<AccountFormErrors>({})

  function updateValues(changes: Partial<AccountFormValues>) {
    setValues((current) => ({ ...current, ...changes }))
    setErrors((current) => {
      const next = { ...current }
      if ('username' in changes) delete next.username
      if ('password' in changes) delete next.password
      return next
    })
  }

  function saveAccount(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const foundErrors = validateAccountForm(values, accounts, account?.username)
    if (Object.keys(foundErrors).length > 0) {
      setErrors(foundErrors)
      return
    }
    onSave({ username: values.username })
  }

  const passwordHelp = isEditing ? 'Leave blank to keep the current password.' : undefined

  return (
    <Modal isOpen labelledBy={titleId} onClose={onCancel}>
      <form noValidate onSubmit={saveAccount}>
        <h2 id={titleId} className="m-0 mb-2 text-xl font-semibold">
          {isEditing ? `Edit ${account.username}` : 'Add account'}
        </h2>
        <div className="mb-6 flex flex-col gap-4">
          <Field
            label="Username"
            htmlFor={usernameId}
            message={errors.username}
            isError={errors.username !== undefined}
          >
            <TextInput
              id={usernameId}
              isMono
              autoComplete="off"
              value={values.username}
              hasError={errors.username !== undefined}
              aria-describedby={errors.username ? `${usernameId}-message` : undefined}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateValues({ username: event.target.value })
              }
            />
          </Field>
          <Field
            label={isEditing ? 'New password (optional)' : 'Password'}
            htmlFor={passwordId}
            message={errors.password ?? passwordHelp}
            isError={errors.password !== undefined}
          >
            <TextInput
              id={passwordId}
              type="password"
              autoComplete="new-password"
              value={values.password}
              hasError={errors.password !== undefined}
              aria-describedby={
                errors.password || passwordHelp ? `${passwordId}-message` : undefined
              }
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateValues({ password: event.target.value })
              }
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Save changes' : 'Add account'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
