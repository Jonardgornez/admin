import { PageHeader } from '../component/layout/page-header'
import { SettingsCard } from '../component/settings/settings-card'
import { SettingsFieldset } from '../component/settings/settings-fieldset'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { Checkbox, RadioOption } from '../component/ui/choice'
import { Field, TextArea, TextInput } from '../component/ui/field'
import { Icon } from '../component/ui/icon'
import { useNotify } from '../component/ui/notification-context'

export function SettingsPage() {
  const notify = useNotify()

  return (
    <>
      <PageHeader title="Settings">
        <Button variant="primary" onClick={() => notify('Settings saved.')}>
          <Icon name="check" />
          Save changes
        </Button>
      </PageHeader>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(var(--spacing-settings-card),100%),1fr))] items-start gap-5">
        <SettingsCard title="Admin password">
          <Field label="Current password" htmlFor="settings-current-password">
            <TextInput
              id="settings-current-password"
              type="password"
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" htmlFor="settings-new-password">
            <TextInput id="settings-new-password" type="password" autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password" htmlFor="settings-confirm-password">
            <TextInput
              id="settings-confirm-password"
              type="password"
              autoComplete="new-password"
            />
          </Field>
          <p className="m-0 text-xs text-ink-muted">
            Changing the password signs out every open console session.
          </p>
          <div>
            <Button
              variant="secondary"
              type="button"
              onClick={() => notify('Admin password changed.', 'lock')}
            >
              Change password
            </Button>
          </div>
        </SettingsCard>

        <SettingsCard title="Server">
          <Field
            label="Server IP address (fixed)"
            htmlFor="settings-server-ip"
            message="Set in Windows network settings. Clients connect to this address."
          >
            <TextInput id="settings-server-ip" isMono value="192.168.1.10" disabled readOnly />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Client port (LAN)" htmlFor="settings-client-port">
              <TextInput id="settings-client-port" isMono placeholder="[PORT]" />
            </Field>
            <Field label="Console port (localhost)" htmlFor="settings-console-port">
              <TextInput id="settings-console-port" isMono placeholder="[PORT]" />
            </Field>
          </div>
          <Banner variant="neutral" icon="lock">
            The Admin Console and TV Wall listen only on localhost. They cannot be opened from other
            devices.
          </Banner>
        </SettingsCard>

        <SettingsCard title="Login requests">
          <SettingsFieldset legend="Default approval">
            <RadioOption name="settings-approval" defaultChecked>
              Time limit
            </RadioOption>
            <RadioOption name="settings-approval">Open time (no limit)</RadioOption>
          </SettingsFieldset>
          <Field
            label="Default time limit (minutes)"
            htmlFor="settings-time-limit"
            className="max-w-60"
          >
            <TextInput id="settings-time-limit" type="number" defaultValue={60} />
          </Field>
          <p className="m-0 text-xs text-ink-muted">You can change this for each approval.</p>
        </SettingsCard>

        <SettingsCard title="Monitoring notice">
          <label className="flex items-center gap-2 font-semibold">
            <Checkbox defaultChecked />
            Show the notice on the client login screen
          </label>
          <Field label="Notice text" htmlFor="settings-notice-text">
            <TextArea
              id="settings-notice-text"
              rows={3}
              className="resize-y"
              defaultValue="This computer may be monitored by the administrator."
            />
          </Field>
        </SettingsCard>

        <SettingsCard title="Console session">
          <Field
            label="Sign out after inactivity (minutes)"
            htmlFor="settings-idle-timeout"
            className="max-w-60"
          >
            <TextInput id="settings-idle-timeout" type="number" defaultValue={30} />
          </Field>
          <SettingsFieldset legend="Default screen view mode">
            <RadioOption name="settings-view-mode" defaultChecked>
              Notified
            </RadioOption>
            <RadioOption name="settings-view-mode">Anonymous</RadioOption>
          </SettingsFieldset>
        </SettingsCard>
      </div>
    </>
  )
}
