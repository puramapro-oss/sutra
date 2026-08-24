import { motion } from 'framer-motion'
import { ArrowLeft, Settings2 } from 'lucide-react'
import Link from 'next/link'
import Button from '@/components/ui/Button'

export function PageHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-8"
    >
      <Link
        href="/settings"
        data-testid="back-to-settings"
        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux parametres
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-violet-300 bg-clip-text text-transparent">
            Comptes sociaux
          </h1>
          <p className="mt-2 text-white/60 text-sm sm:text-base">
            Connecte tes reseaux pour publier automatiquement avec l&apos;autopilot IA.
          </p>
        </div>

        <Link href="#autopilot" data-testid="link-autopilot-config">
          <Button variant="secondary" size="md">
            <Settings2 className="w-4 h-4" />
            Configurer l&apos;autopilot
          </Button>
        </Link>
      </div>
    </motion.div>
  )
}
