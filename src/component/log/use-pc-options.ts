import { useEffect, useState } from 'react'
import { listPcs } from '../../lib/pcs-api'
import { useSessionRequest } from '../auth/use-session-request'

export interface PcOption {
  id: number
  name: string
}

const byName = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

// The registered PCs for the log filter, sorted by name so PC-2 comes before PC-10.
// If the list can't load, the filter still offers All PCs, so no error is shown here.
export function usePcOptions(): PcOption[] {
  const request = useSessionRequest()
  const [options, setOptions] = useState<PcOption[]>([])

  useEffect(() => {
    let isCurrent = true
    void request(listPcs()).then((result) => {
      if (!isCurrent || !result.success) return
      const sorted = result.data
        .map((pc) => ({ id: pc.id, name: pc.name }))
        .sort((first, second) => byName.compare(first.name, second.name))
      setOptions(sorted)
    })
    return () => {
      isCurrent = false
    }
  }, [request])

  return options
}
