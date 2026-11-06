import { FormProvider } from 'react-hook-form'
import { PageHeader } from '../component/layout/page-header'
import { ChangePasswordForm } from '../component/settings/change-password-form'
import { ConsoleSessionCard } from '../component/settings/console-session-card'
import { LoginRequestsCard } from '../component/settings/login-requests-card'
import { MonitoringNoticeCard } from '../component/settings/monitoring-notice-card'
import { PcPowerCard } from '../component/settings/pc-power-card'
import { ServerCard } from '../component/settings/server-card'
import { SettingsCard } from '../component/settings/settings-card'
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
      <PageHeader title="Settings">
        <Button
          variant="primary"
          type="submit"
          form={SETTINGS_FORM_ID}
          disabled={!isLoaded || isSaving}
        >
          <Icon name="check" />
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
      </PageHeader>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(var(--spacing-settings-card),100%),1fr))] items-start gap-5">
        <SettingsCard title="Admin password">
          <ChangePasswordForm />
        </SettingsCard>

        <ServerCard />

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
              <MonitoringNoticeCard />
              <ConsoleSessionCard />
            </form>
          </FormProvider>
        )}
      </div>
    </>
  )
}
