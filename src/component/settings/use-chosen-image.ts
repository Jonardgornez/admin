import { useCallback, useEffect, useRef, useState } from 'react'

export interface ChosenImage {
  file: File
  previewUrl: string
}

// Holds the image the admin picked but has not uploaded. Its preview URL is released when it changes or the component unmounts.
export function useChosenImage() {
  const [chosen, setChosen] = useState<ChosenImage | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const releasePreview = useCallback(() => {
    if (previewUrlRef.current === null) return
    URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
  }, [])

  useEffect(() => () => releasePreview(), [releasePreview])

  const choose = useCallback(
    (file: File | null) => {
      releasePreview()
      if (file === null) {
        setChosen(null)
        return
      }
      const previewUrl = URL.createObjectURL(file)
      previewUrlRef.current = previewUrl
      setChosen({ file, previewUrl })
    },
    [releasePreview],
  )

  return { chosen, choose }
}
