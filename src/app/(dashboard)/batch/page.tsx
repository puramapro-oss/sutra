'use client'

import { useAuth } from '@/hooks/useAuth'
import { useBatch } from '@/hooks/useBatch'
import { Skeleton } from '@/components/ui/Skeleton'
import BatchHeader from '@/components/batch/BatchHeader'
import BatchInputMode from '@/components/batch/BatchInputMode'
import BatchGlobalConfig from '@/components/batch/BatchGlobalConfig'
import BatchPreviewTable from '@/components/batch/BatchPreviewTable'
import BatchActions from '@/components/batch/BatchActions'
import BatchSummary from '@/components/batch/BatchSummary'
import type { Plan } from '@/types'

export default function BatchPage() {
  const { profile, loading: authLoading } = useAuth()
  const userPlan: Plan = profile?.plan ?? 'free'

  const {
    inputMode,
    setInputMode,
    textInput,
    setTextInput,
    items,
    globalConfig,
    setGlobalConfig,
    isProcessing,
    completedCount,
    editingId,
    editValue,
    setEditValue,
    fileInputRef,
    maxItems,
    parseTextInput,
    handleCSVUpload,
    addRow,
    deleteRow,
    startEdit,
    saveEdit,
    cancelEdit,
    processQueue,
    stopProcessing,
  } = useBatch(userPlan)

  if (authLoading) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const totalItems = items.filter((it) => it.topic.trim()).length
  const doneItems = items.filter((it) => it.status === 'done').length
  const errorItems = items.filter((it) => it.status === 'error').length

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" data-testid="batch-page">
      <BatchHeader userPlan={userPlan} />

      <BatchInputMode
        inputMode={inputMode}
        setInputMode={setInputMode}
        textInput={textInput}
        setTextInput={setTextInput}
        maxItems={maxItems}
        parseTextInput={parseTextInput}
        handleCSVUpload={handleCSVUpload}
        fileInputRef={fileInputRef}
        isProcessing={isProcessing}
      />

      <BatchGlobalConfig
        globalConfig={globalConfig}
        setGlobalConfig={setGlobalConfig}
        userPlan={userPlan}
        isProcessing={isProcessing}
      />

      <BatchPreviewTable
        items={items}
        totalItems={totalItems}
        doneItems={doneItems}
        errorItems={errorItems}
        completedCount={completedCount}
        isProcessing={isProcessing}
        maxItems={maxItems}
        editingId={editingId}
        editValue={editValue}
        setEditValue={setEditValue}
        addRow={addRow}
        deleteRow={deleteRow}
        startEdit={startEdit}
        saveEdit={saveEdit}
        cancelEdit={cancelEdit}
      />

      <BatchActions
        totalItems={totalItems}
        completedCount={completedCount}
        isProcessing={isProcessing}
        maxItems={maxItems}
        itemsLength={items.length}
        addRow={addRow}
        stopProcessing={stopProcessing}
        processQueue={processQueue}
      />

      <BatchSummary
        isProcessing={isProcessing}
        doneItems={doneItems}
        errorItems={errorItems}
      />
    </div>
  )
}
