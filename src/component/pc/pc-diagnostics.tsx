import { useId, type ReactNode } from 'react'
import { cva } from 'class-variance-authority'
import { formatClientVersion } from '../../lib/client-updates'
import {
  DIAGNOSTICS_EMPTY_TEXT,
  getUpdateStatusLabel,
  sortEventsNewestFirst,
  type PcDiagnosticsState,
} from '../../lib/diagnostics'
import { isServiceReportFresh } from '../../lib/pcs'
import { formatRequestDateTime, formatRequestedAgo } from '../../lib/requests'
import type {
  DiagnosticsEvent,
  DiagnosticsEventLevel,
  DiagnosticsUpdate,
  PcDiagnostics as PcDiagnosticsReport,
} from '../../types'
import { Banner } from '../ui/banner'
import { Icon, type IconName } from '../ui/icon'
import { usePcDiagnostics } from './use-pc-diagnostics'

const LEVEL_LABELS: Record<DiagnosticsEventLevel, string> = {
  information: 'Information',
  warning: 'Warning',
  error: 'Error',
}

const LEVEL_ICONS: Record<DiagnosticsEventLevel, IconName> = {
  information: 'info',
  warning: 'alert',
  error: 'alert',
}

const levelIconVariants = cva('mt-0.5 flex-none', {
  variants: {
    level: {
      information: 'text-ink-muted',
      warning: 'text-st-reboot',
      error: 'text-danger',
    },
  },
  defaultVariants: {
    level: 'information',
  },
})

interface PcDiagnosticsProps {
  pcId: number
}

// Lives inside the PC details dialog, so it polls only while that dialog is open.
export function PcDiagnostics({ pcId }: PcDiagnosticsProps) {
  const headingId = useId()
  const state = usePcDiagnostics(pcId)

  return (
    <section aria-labelledby={headingId} className="border-t border-border pt-4">
      <h3 id={headingId} className="m-0 pb-2 text-xs font-semibold tracking-label text-ink-muted">
        Diagnostics
      </h3>
      <PcDiagnosticsBody state={state} />
    </section>
  )
}

interface PcDiagnosticsBodyProps {
  state: PcDiagnosticsState
}

function PcDiagnosticsBody({ state }: PcDiagnosticsBodyProps) {
  if (state.status === 'loading') {
    return (
      <p role="status" className="m-0 text-sm text-ink-muted">
        Loading diagnostics…
      </p>
    )
  }
  if (state.status === 'empty') {
    return <p className="m-0 text-sm text-ink-muted">{DIAGNOSTICS_EMPTY_TEXT}</p>
  }
  if (state.status === 'error') {
    return (
      <Banner variant="danger" icon="alert" role="alert">
        Couldn't load diagnostics. {state.error} It will try again shortly.
      </Banner>
    )
  }
  return <DiagnosticsReport report={state.report} now={state.now} />
}

interface DiagnosticsReportProps {
  report: PcDiagnosticsReport
  now: Date
}

function DiagnosticsReport({ report, now }: DiagnosticsReportProps) {
  const isStale = !isServiceReportFresh(report.receivedAt, now)

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="m-0">Last report: {formatRequestedAgo(report.receivedAt, now)}</p>
      {isStale && (
        <Banner variant="warning" icon="alert">
          This report is more than 3 minutes old. The PC may be off, or its service may have
          stopped.
        </Banner>
      )}
      <dl className="m-0 flex flex-col gap-1.5">
        <DiagnosticRow label="Service version" value={formatClientVersion(report.serviceVersion)} />
        <DiagnosticRow label="Client running" value={<YesNo isYes={report.clientRunning} />} />
        <DiagnosticRow label="Client version" value={formatClientVersion(report.clientVersion)} />
        <DiagnosticRow label="User signed in" value={<YesNo isYes={report.userSignedIn} />} />
      </dl>
      <UpdateStatus update={report.update} />
      <DiagnosticEvents events={report.events} />
    </div>
  )
}

interface DiagnosticRowProps {
  label: string
  value: ReactNode
}

function DiagnosticRow({ label, value }: DiagnosticRowProps) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-right font-semibold">{value}</dd>
    </div>
  )
}

function YesNo({ isYes }: { isYes: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon name={isYes ? 'check' : 'x'} size={14} />
      {isYes ? 'Yes' : 'No'}
    </span>
  )
}

function UpdateStatus({ update }: { update: DiagnosticsUpdate | null }) {
  if (update === null) return <p className="m-0">No update queued.</p>
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0">{getUpdateStatusLabel(update)}</p>
      {update.state === 'failed' && (
        <p className="m-0 flex items-start gap-2 break-words text-danger">
          <Icon name="alert" size={14} className="mt-0.5" />
          {update.error ?? 'The PC did not say why the update failed.'}
        </p>
      )}
    </div>
  )
}

function DiagnosticEvents({ events }: { events: DiagnosticsEvent[] }) {
  if (events.length === 0) return <p className="m-0 text-ink-muted">No events reported.</p>
  return (
    <div className="flex flex-col gap-2">
      <h4 className="m-0 text-xs font-semibold tracking-label text-ink-muted">Recent events</h4>
      <ul role="list" className="m-0 flex list-none flex-col gap-2 p-0">
        {sortEventsNewestFirst(events).map((event, index) => (
          <DiagnosticEventItem key={`${event.at}-${index}`} event={event} />
        ))}
      </ul>
    </div>
  )
}

function DiagnosticEventItem({ event }: { event: DiagnosticsEvent }) {
  return (
    <li className="flex min-w-0 gap-2 rounded-md border border-border p-2">
      <Icon
        name={LEVEL_ICONS[event.level]}
        size={16}
        className={levelIconVariants({ level: event.level })}
      />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-xs text-ink-muted">
          <span className="font-semibold text-ink">{LEVEL_LABELS[event.level]}</span>
          {' · '}
          <time dateTime={event.at}>{formatRequestDateTime(event.at)}</time>
        </p>
        <p className="m-0 break-words">{event.message}</p>
      </div>
    </li>
  )
}
