import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

export function SuccessScreen({ email }: { email: string }) {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 bg-[#06050e]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 text-center shadow-2xl shadow-violet-500/5">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="font-display text-xl font-bold text-white mb-2">
            Verifie ton email
          </h2>
          <p className="text-white/50 text-sm mb-6 leading-relaxed">
            Un email de confirmation a ete envoye a{' '}
            <span className="text-violet-400 font-medium">{email}</span>.
            <br />
            Clique sur le lien pour activer ton compte.
          </p>
          <Link href="/login">
            <Button variant="secondary" size="md">
              Retour a la connexion
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
