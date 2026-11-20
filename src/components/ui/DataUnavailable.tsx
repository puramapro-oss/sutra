import Button from './Button'

export function DataUnavailable({ title, message, onRetry }: {
  title: string
  message: string
  onRetry: () => unknown
}) {
  return (
    <section className="max-w-4xl mx-auto space-y-4" role="alert">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      <p className="text-sm text-white/70">{message}</p>
      <Button onClick={() => { void onRetry() }}>Réessayer</Button>
    </section>
  )
}
