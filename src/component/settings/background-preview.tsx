import { NO_BACKGROUND_TEXT } from '../../lib/backgrounds'

interface BackgroundPreviewProps {
  src: string | null
  alt: string
}

export function BackgroundPreview({ src, alt }: BackgroundPreviewProps) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-surface-100">
      {src ? (
        <img
          src={src}
          alt={alt}
          width={1600}
          height={900}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <p className="absolute inset-0 m-0 flex items-center justify-center p-4 text-center text-sm text-ink-muted">
          {NO_BACKGROUND_TEXT}
        </p>
      )}
    </div>
  )
}
