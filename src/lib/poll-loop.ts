// Runs poll right away, then again intervalMs after the previous run settles,
// so two polls from the same loop never overlap. The returned function stops the loop.
// Polls are expected to report failures as results rather than throw.
export function startPollLoop(poll: () => Promise<void>, intervalMs: number): () => void {
  let isStopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  async function run() {
    try {
      await poll()
    } finally {
      if (!isStopped) timer = setTimeout(() => void run(), intervalMs)
    }
  }

  void run()
  return () => {
    isStopped = true
    clearTimeout(timer)
  }
}
