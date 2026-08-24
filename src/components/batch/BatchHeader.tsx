import { motion } from 'framer-motion'
import { ListVideo } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { Plan } from '@/types'

interface BatchHeaderProps {
  userPlan: Plan
}

export default function BatchHeader({ userPlan }: BatchHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
          <ListVideo className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white font-display tracking-tight">
            Generation par lot
          </h1>
          <p className="text-sm text-white/50">
            Genere plusieurs videos d&apos;un coup
          </p>
        </div>
      </div>
      <div className="mt-3">
        <Badge variant="premium" size="sm">
          {userPlan === 'free' ? 'Max 2 videos' : userPlan === 'starter' ? 'Max 5 videos' : userPlan === 'creator' ? 'Max 20 videos' : 'Illimite'}
        </Badge>
      </div>
    </motion.div>
  )
}
