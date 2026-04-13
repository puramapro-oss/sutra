"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Invoice {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  invoice_number: string;
  description: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setInvoices(data || []);
      setLoading(false);
    };

    fetchInvoices();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-white mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Factures
        </h1>
        <p className="text-white/50 text-sm">
          Historique de tes paiements et factures SUTRA.
        </p>
      </div>

      {/* Company info */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-6">
        <p className="text-xs text-white/40 leading-relaxed">
          <strong className="text-white/60">SASU PURAMA</strong> — 8 Rue de la
          Chapelle, 25560 Frasne, France
          <br />
          TVA non applicable, art. 293B du CGI
          <br />
          Numero de facture : FA-2026-XXXXXX
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <p className="text-white/40 text-sm">Chargement des factures...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <FileText className="w-8 h-8 text-white/20" />
          </div>
          <h3 className="text-lg font-semibold text-white/60 mb-2">
            Aucune facture
          </h3>
          <p className="text-sm text-white/30">
            Tes factures apparaitront ici apres ton premier paiement.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice, i) => (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {invoice.invoice_number || `FA-${invoice.id.slice(0, 8).toUpperCase()}`}
                  </p>
                  <p className="text-xs text-white/40">
                    {formatDate(invoice.created_at)} —{" "}
                    {invoice.description || "Abonnement SUTRA"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-bold text-white">
                    {(invoice.amount / 100).toFixed(2)} EUR
                  </p>
                  <p
                    className={`text-xs font-medium ${
                      invoice.status === "paid"
                        ? "text-green-400"
                        : invoice.status === "pending"
                          ? "text-yellow-400"
                          : "text-red-400"
                    }`}
                  >
                    {invoice.status === "paid"
                      ? "Payee"
                      : invoice.status === "pending"
                        ? "En attente"
                        : "Echouee"}
                  </p>
                </div>
                <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  <Download className="w-4 h-4 text-white/40" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Stripe portal link */}
      <div className="mt-8 text-center">
        <a
          href="/api/stripe/portal"
          className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Gerer mon abonnement sur Stripe
        </a>
      </div>
    </div>
  );
}
