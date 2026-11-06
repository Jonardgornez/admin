const REVOKE_DELAY_MS = 1000

// Resolves false when no image could be made. Nothing is sent to the server.
export async function saveCanvasAsPng(canvas: HTMLCanvasElement, fileName: string): Promise<boolean> {
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return false
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    // Some browsers cancel the download when the URL is revoked right after the click.
    window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
    return true
  } catch {
    return false
  }
}
