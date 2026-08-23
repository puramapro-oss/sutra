import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Loader2, Send, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'

export function EscaladeForm() {
  const [showEscalade, setShowEscalade] = useState(false)
  const [escaladeName, setEscaladeName] = useState('')
  const [escaladeEmail, setEscaladeEmail] = useState('')
  const [escaladeMessage, setEscaladeMessage] = useState('')
  const [escaladeLoading, setEscaladeLoading] = useState(false)
  const [escaladeSent, setEscaladeSent] = useState(false)

  const handleEscalade = async () => {
    if (!escaladeName.trim() || !escaladeEmail.trim() || !escaladeMessage.trim()) {
      toast.error('Remplis tous les champs')
      return
    }
    setEscaladeLoading(true)
    try {
      const res = await fetch('/api/email/escalade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: escaladeName, email: escaladeEmail, message: escaladeMessage }),
      })
      if (res.ok) {
        setEscaladeSent(true)
        toast.success('Message envoye ! On te repond sous 24h.')
      } else {
        toast.error("Erreur lors de l&apos;envoi. Reessaie.")
      }
    } catch {
      toast.error('Erreur reseau')
    } finally {
      setEscaladeLoading(false)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-white flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-pink-400" />
        Contact humain
      </h2>
      <p className="text-sm text-white/50">
        Le chatbot ne repond pas a ta question ? Ecris-nous, on te repond sous 24h.
      </p>

      {!showEscalade && !escaladeSent && (
        <Button
          variant="secondary"
          onClick={() => setShowEscalade(true)}
          className="flex items-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          Ecrire au support
        </Button>
      )}

      <AnimatePresence>
        {showEscalade && !escaladeSent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  value={escaladeName}
                  onChange={(e) => setEscaladeName(e.target.value)}
                  placeholder="Ton prenom"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
                />
                <input
                  value={escaladeEmail}
                  onChange={(e) => setEscaladeEmail(e.target.value)}
                  placeholder="ton@email.com"
                  type="email"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <textarea
                value={escaladeMessage}
                onChange={(e) => setEscaladeMessage(e.target.value)}
                placeholder="Decris ton probleme en detail..."
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEscalade(false)}
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleEscalade}
                  disabled={escaladeLoading}
                >
                  {escaladeLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" /> Envoyer
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {escaladeSent && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 border border-emerald-500/20 text-center"
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <h3 className="font-semibold text-white">Message envoye</h3>
          <p className="text-white/50 text-sm mt-1">On te repond sous 24h sur {escaladeEmail}</p>
        </motion.div>
      )}
    </section>
  )
}
