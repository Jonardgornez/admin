import { useId, useState, type ChangeEvent, type SubmitEvent } from 'react'
import { validateAccountForm } from '../../lib/accounts'
import type { Account, AccountDetails, AccountFormErrors, AccountFormValues } from '../../types'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/choice'
import { Field, SelectInput, TextInput } from '../ui/field'
import { Modal } from '../ui/modal'

interface AccountFormDialogProps {
  account?: Account
  accounts: Account[]
  pcNames: string[]
  onSave: (details: AccountDetails) => void
  onCancel: () => void
}

export function AccountFormDialog({
  account,
  accounts,
  pcNames,
  onSave,
  onCancel,
}: AccountFormDialogProps) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const usernameId = `${baseId}-username`
  const passwordId = `${baseId}-password`
  const pcId = `${baseId}-pc`
  const isEditing = account !== undefined

  const [values, setValues] = useState<AccountFormValues>({
    username: account?.username ?? '',
    password: '',
    assignedPc: account?.assignedPc ?? '',
    canUseAnyPc: account?.canUseAnyPc ?? false,
  })
  const [errors, setErrors] = useState<AccountFormErrors>({})

  function updateValues(changes: Partial<AccountFormValues>) {
    setValues((current) => ({ ...current, ...changes }))
    setErrors((current) => {
      const next = { ...current }
      if ('username' in changes) delete next.username
      if ('password' in changes) delete next.password
      if ('assignedPc' in changes) delete next.assignedPc
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
    onSave({
      username: values.username,
      assignedPc: values.assignedPc,
      canUseAnyPc: values.canUseAnyPc,
    })
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
          <Field
            label="Assigned PC"
            htmlFor={pcId}
            message={errors.assignedPc}
            isError={errors.assignedPc !== undefined}
          >
            <SelectInput
              id={pcId}
              value={values.assignedPc}
              hasError={errors.assignedPc !== undefined}
              aria-describedby={errors.assignedPc ? `${pcId}-message` : undefined}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                updateValues({ assignedPc: event.target.value })
              }
            >
              <option value="" disabled>
                Choose a PC
              </option>
              {pcNames.map((pcName) => (
                <option key={pcName} value={pcName}>
                  {pcName}
                </option>
              ))}
            </SelectInput>
          </Field>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={values.canUseAnyPc}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                updateValues({ canUseAnyPc: event.target.checked })
              }
            />
            Allow use on any PC
          </label>
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
