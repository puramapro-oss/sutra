import { useState, useCallback, useRef } from 'react'
import type { HistoryState } from '@/types/editor'
import { MAX_HISTORY } from '@/types/editor'

export function useEditorHistory() {
  const [history, setHistory] = useState<HistoryState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedoRef = useRef(false)

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const pushHistory = useCallback(
    (state: HistoryState) => {
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false
        return
      }
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1)
        newHistory.push(state)
        if (newHistory.length > MAX_HISTORY) newHistory.shift()
        return newHistory
      })
      setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1))
    },
    [historyIndex]
  )

  const undo = useCallback(() => {
    if (!canUndo) return null
    isUndoRedoRef.current = true
    const prevState = history[historyIndex - 1]
    setHistoryIndex((prev) => prev - 1)
    return prevState
  }, [canUndo, history, historyIndex])

  const redo = useCallback(() => {
    if (!canRedo) return null
    isUndoRedoRef.current = true
    const nextState = history[historyIndex + 1]
    setHistoryIndex((prev) => prev + 1)
    return nextState
  }, [canRedo, history, historyIndex])

  return {
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}
