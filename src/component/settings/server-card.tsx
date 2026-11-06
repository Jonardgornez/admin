import type { ServerInfo } from '../../lib/server-info-api'
import { Banner } from '../ui/banner'
import { Button } from '../ui/button'
import { Field, TextInput } from '../ui/field'
import { Icon } from '../ui/icon'
import { SettingsCard } from './settings-card'
import { useServerInfo } from './use-server-info'

const NO_ADDRESS_MESSAGE = 'No network address found. Check the network connection.'
const FIXED_IP_NOTE =
  'Keep this PC on a fixed IP. Registered PCs keep the address they were set up with.'

interface OtherAddressesProps {
  addresses: string[]
}

function OtherAddresses({ addresses }: OtherAddressesProps) {
  return (
    <section aria-labelledby="settings-other-addresses" className="flex flex-col gap-1.5">
      <h3
        id="settings-other-addresses"
        className="m-0 text-xs font-semibold tracking-label text-ink-muted"
      >
        Other addresses on this PC
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-sm">
        {addresses.map((address) => (
          <li key={address}>{address}</li>
        ))}
      </ul>
    </section>
  )
}

interface ServerDetailsProps {
  info: ServerInfo
}

function ServerDetails({ info }: ServerDetailsProps) {
  const hasAddress = info.primaryAddress !== null
  return (
    <>
      <Field
        label="Server IP address (detected)"
        htmlFor="settings-server-ip"
        message={hasAddress ? 'PCs connect to this address.' : NO_ADDRESS_MESSAGE}
        isError={!hasAddress}
      >
        <TextInput
          id="settings-server-ip"
          isMono
          value={info.primaryAddress ?? ''}
          disabled
          readOnly
        />
      </Field>
      {info.otherAddresses.length > 0 && <OtherAddresses addresses={info.otherAddresses} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Client port (LAN)" htmlFor="settings-client-port">
          <TextInput id="settings-client-port" isMono value={info.clientPort} disabled readOnly />
        </Field>
        <Field label="Console port (localhost)" htmlFor="settings-console-port">
          <TextInput id="settings-console-port" isMono value={info.adminPort} disabled readOnly />
        </Field>
      </div>
    </>
  )
}

export function ServerCard() {
  const { loadState, retry } = useServerInfo()

  return (
    <SettingsCard title="Server">
      {loadState.status === 'loading' && (
        <p role="status" className="m-0 text-base text-ink-muted">
          Loading server details...
        </p>
      )}
      {loadState.status === 'error' && (
        <>
          <Banner variant="danger" icon="alert" role="alert">
            {loadState.error}
          </Banner>
          <div>
            <Button variant="secondary" onClick={retry}>
              <Icon name="refresh" />
              Retry
            </Button>
          </div>
        </>
      )}
      {loadState.status === 'loaded' && <ServerDetails info={loadState.info} />}
      <Banner variant="neutral" icon="lock">
        The Admin Console and TV Wall listen only on localhost. They cannot be opened from other
        devices.
      </Banner>
      <p className="m-0 text-xs text-ink-muted">{FIXED_IP_NOTE}</p>
    </SettingsCard>
  )
}
