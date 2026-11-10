import { FormProvider } from 'react-hook-form'
import { PageHeader } from '../component/layout/page-header'
import { ChangePasswordForm } from '../component/settings/change-password-form'
import { ClientUpdateCard } from '../component/settings/client-update-card'
import { ConsoleSessionCard } from '../component/settings/console-session-card'
import { LockScreenCard } from '../component/settings/lock-screen-card'
import { LoginRequestsCard } from '../component/settings/login-requests-card'
import { MonitoringNoticeCard } from '../component/settings/monitoring-notice-card'
import { PcPowerCard } from '../component/settings/pc-power-card'
import { ScreenBackgroundsCard } from '../component/settings/screen-backgrounds-card'
import { ServerCard } from '../component/settings/server-card'
import { SettingsCard } from '../component/settings/settings-card'
import { SettingsSection } from '../component/settings/settings-section'
import { useSettingsEditor } from '../component/settings/use-settings-editor'
import { Banner } from '../component/ui/banner'
import { Button } from '../component/ui/button'
import { Icon } from '../component/ui/icon'

const SETTINGS_FORM_ID = 'settings-form'

export function SettingsPage() {
  const { form, loadState, isLoaded, isSaving, retry, saveSettingsForm } = useSettingsEditor()
  const rootError = form.formState.errors.root

  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-10">
        <SettingsSection
          id="settings-preferences"
          title="Lab PC preferences"
          description="How lab PCs and this console behave. Click Save changes to apply."
          actions={
            <Button
              variant="primary"
              type="submit"
              form={SETTINGS_FORM_ID}
              disabled={!isLoaded || isSaving}
            >
              <Icon name="check" />
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          }
        >
          {loadState.status === 'loading' && (
            <p role="status" className="col-span-full m-0 text-base text-ink-muted">
              Loading settings...
            </p>
          )}
          {loadState.status === 'error' && (
            <div className="col-span-full flex flex-col items-start gap-3">
              <Banner
                variant="danger"
                icon="alert"
                title="Can't load settings"
                role="alert"
                className="w-full"
              >
                {loadState.error}
              </Banner>
              <Button variant="secondary" onClick={retry}>
                <Icon name="refresh" />
                Retry
              </Button>
            </div>
          )}
          {isLoaded && (
            <FormProvider {...form}>
              <form
                id={SETTINGS_FORM_ID}
                noValidate
                className="contents"
                onSubmit={(event) => form.handleSubmit(saveSettingsForm)(event)}
              >
                {rootError && (
                  <Banner variant="danger" icon="alert" role="alert" className="col-span-full">
                    {rootError.message}
                  </Banner>
                )}
                <LoginRequestsCard />
                <PcPowerCard />
                <LockScreenCard />
                <MonitoringNoticeCard />
                <ConsoleSessionCard />
              </form>
            </FormProvider>
          )}
        </SettingsSection>

        <SettingsSection
          id="settings-files"
          title="Files for lab PCs"
          description="Uploads and removals take effect right away. No need to click Save changes."
        >
          <ScreenBackgroundsCard />
          <ClientUpdateCard />
        </SettingsSection>

        <SettingsSection
          id="settings-server-account"
          title="Server and account"
          description="This server's network details and your admin password."
        >
          <ServerCard />
          <SettingsCard title="Admin password">
            <ChangePasswordForm />
          </SettingsCard>
        </SettingsSection>
      </div>
    </>
  )
}
