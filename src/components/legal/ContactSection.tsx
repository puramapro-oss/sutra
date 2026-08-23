export default function ContactSection() {
  return (
    <div className="pt-8 border-t border-white/[0.06]">
      <h3 className="text-sm font-semibold text-white mb-3">
        Contact
      </h3>
      <div className="text-sm text-white/50 space-y-1">
        <p>PURAMA SASU — Capital 1 euro</p>
        <p>8 Rue de la Chapelle, 25560 Frasne, France</p>
        <p>Responsable du traitement : Matiss Dornier, President</p>
        <p>
          Email :{' '}
          <a
            href="mailto:matiss.frasne@gmail.com"
            className="text-violet-400 hover:text-violet-300"
          >
            matiss.frasne@gmail.com
          </a>
        </p>
      </div>
    </div>
  )
}
