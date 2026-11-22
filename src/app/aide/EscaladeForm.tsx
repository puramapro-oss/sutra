import { useId, useRef, useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Loader2, Send, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import Button from '@/components/ui/Button'
import { contactSchema } from '@/lib/validators'

export function EscaladeForm() {
  const [showEscalade, setShowEscalade] = useState(false)
  const [escaladeName, setEscaladeName] = useState('')
  const [escaladeEmail, setEscaladeEmail] = useState('')
  const [escaladeMessage, setEscaladeMessage] = useState('')
  const [escaladeLoading, setEscaladeLoading] = useState(false)
  const [escaladeSent, setEscaladeSent] = useState(false)
  const inFlight = useRef(false)
  const fieldsId = useId()

  const handleEscalade = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (inFlight.current) return
    if (!escaladeName.trim() || !escaladeEmail.trim() || !escaladeMessage.trim()) {
      toast.error('Remplis tous les champs')
      return
    }
    const payload = contactSchema.safeParse({
      email: escaladeEmail.trim(),
      subject: 'Demande d’aide SUTRA',
      message: `Prénom : ${escaladeName.trim()}\n\n${escaladeMessage.trim()}`,
    })
    if (!payload.success) {
      toast.error('Verifie ton adresse email et la longueur du message')
      return
    }
    inFlight.current = true
    setEscaladeLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.data),
      })
      const receipt: unknown = await res.json().catch(() => null)
      if (!res.ok || !receipt || typeof receipt !== 'object'
        || !('success' in receipt) || receipt.success !== true) {
        toast.error('Envoi non confirme. Ton message est conserve, tu peux reessayer.')
        return
      }
      setEscaladeSent(true)
      toast.success('Message transmis au support')
    } catch {
      toast.error('Envoi non confirme. Verifie ta connexion avant de reessayer.')
    } finally {
      inFlight.current = false
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
        Le chatbot ne repond pas a ta question ? Ecris a notre equipe.
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
          <motion.form
            onSubmit={handleEscalade}
            aria-busy={escaladeLoading}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="sr-only" htmlFor={`${fieldsId}-name`}>Ton prenom</label>
                <input
                  id={`${fieldsId}-name`}
                  value={escaladeName}
                  onChange={(e) => setEscaladeName(e.target.value)}
                  placeholder="Ton prenom"
                  autoComplete="given-name"
                  required
                  maxLength={100}
                  disabled={escaladeLoading}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
                />
                <label className="sr-only" htmlFor={`${fieldsId}-email`}>Ton adresse email</label>
                <input
                  id={`${fieldsId}-email`}
                  value={escaladeEmail}
                  onChange={(e) => setEscaladeEmail(e.target.value)}
                  placeholder="ton@email.com"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={escaladeLoading}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <label className="sr-only" htmlFor={`${fieldsId}-message`}>Ton message au support</label>
              <textarea
                id={`${fieldsId}-message`}
                value={escaladeMessage}
                onChange={(e) => setEscaladeMessage(e.target.value)}
                placeholder="Decris ton probleme en detail..."
                rows={4}
                required
                maxLength={1800}
                disabled={escaladeLoading}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50 resize-none"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEscalade(false)}
                  disabled={escaladeLoading}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={escaladeLoading}
                >
                  {escaladeLoading ? (
                    <span className="flex items-center gap-1.5"><Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> Envoi...</span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" /> Envoyer
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {escaladeSent && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 border border-emerald-500/20 text-center"
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <h3 className="font-semibold text-white">Message transmis</h3>
          <p className="text-white/50 text-sm mt-1">Ta demande a ete transmise au support. La reponse sera adressee a {escaladeEmail.trim()}.</p>
        </motion.div>
      )}
    </section>
  )
}
