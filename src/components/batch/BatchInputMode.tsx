import { motion, AnimatePresence } from 'framer-motion'
import { Type, FileSpreadsheet, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { InputMode } from '@/types/batch'

interface BatchInputModeProps {
  inputMode: InputMode
  setInputMode: (mode: InputMode) => void
  textInput: string
  setTextInput: (value: string) => void
  maxItems: number
  parseTextInput: () => void
  handleCSVUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  isProcessing: boolean
}

export default function BatchInputMode({
  inputMode,
  setInputMode,
  textInput,
  setTextInput,
  maxItems,
  parseTextInput,
  handleCSVUpload,
  fileInputRef,
  isProcessing,
}: BatchInputModeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setInputMode('text')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            inputMode === 'text'
              ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
              : 'text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent'
          )}
          data-testid="batch-mode-text"
        >
          <Type className="w-4 h-4" />
          Mode texte
        </button>
        <button
          onClick={() => setInputMode('csv')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            inputMode === 'csv'
              ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
              : 'text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent'
          )}
          data-testid="batch-mode-csv"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Mode CSV
        </button>
      </div>

      <AnimatePresence mode="wait">
        {inputMode === 'text' ? (
          <motion.div
            key="text"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
          >
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={`Un sujet par ligne (max ${maxItems}):\n\nLes bienfaits de la meditation\nComment investir en bourse en 2026\n5 astuces productivite`}
              className="w-full h-40 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/90 placeholder:text-white/25 focus:outline-none focus:border-violet-500/40 resize-none"
              data-testid="batch-text-input"
              disabled={isProcessing}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-white/40">
                {textInput.trim().split('\n').filter(Boolean).length} / {maxItems} lignes
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={parseTextInput}
                disabled={!textInput.trim() || isProcessing}
                data-testid="batch-parse-text"
              >
                Charger les sujets
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="csv"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-40 border-2 border-dashed border-white/[0.08] rounded-xl flex flex-col items-center justify-center gap-3 text-white/40 hover:text-white/60 hover:border-violet-500/30 transition-all group"
              disabled={isProcessing}
              data-testid="batch-csv-upload"
            >
              <Upload className="w-8 h-8 group-hover:text-violet-400 transition-colors" />
              <span className="text-sm font-medium">Cliquer pour importer un fichier .csv</span>
              <span className="text-xs text-white/30">
                Colonnes : sujet, format, qualite, style
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCSVUpload}
              className="hidden"
              data-testid="batch-csv-file-input"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
