import { createElement, useCallback, useLayoutEffect } from 'react'
import { useCreateRequest } from '@/hooks/useCreateRequest'
import { useProductionGeneration } from '@/hooks/useProductionGeneration'
import type { DurableStep } from '@/lib/production-intent-client'

interface ProbeControl {
  record(view: object, actions: object): void
  restored(body: string, step: DurableStep, revision: number): void
}
const control = () => (window as unknown as { durableHooks: ProbeControl }).durableHooks
const noStepChange = () => {}
interface ProbeProps { ownerId: string; revision: number }

function CreateProbe({ ownerId }: ProbeProps) {
  const state = useCreateRequest(ownerId)
  const { submit, resume, cancel, ...view } = state
  const frame = { ...view, ownerId }
  useLayoutEffect(() => { control().record(frame, { submit, resume, cancel }) })
  return createElement('pre', null, JSON.stringify(frame))
}

function ProductionProbe({ ownerId, revision }: ProbeProps) {
  const onRestore = useCallback((body: string, step: DurableStep) => control().restored(body, step, revision), [revision])
  const state = useProductionGeneration({
    userId: ownerId, onRestore, idea: 'Synthetic local recovery test', template: 'youtube',
    format: '16:9', engine: 'ltx-fast', voice: 'rachel', musicStyle: 'cinematic',
    tone: 'professionnel', currentStep: 1, setCurrentStep: noStepChange,
  })
  const { generateStep, generateAll, resume, cancel, ...view } = state
  const frame = { ...view, ownerId }
  useLayoutEffect(() => { control().record(frame, { submit: generateAll, generateStep, resume, cancel }) })
  return createElement('pre', null, JSON.stringify(frame))
}

export function DurableHooksProbe({ kind, ...props }: ProbeProps & { kind: 'create' | 'production' }) {
  return createElement(kind === 'create' ? CreateProbe : ProductionProbe, props)
}
