import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function createSupabaseServer(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "sutra" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Server component — ignore
            }
          });
        },
      },
    }
  );
}

// GET /api/financer — get aides matching user profile, or all aides
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServer(cookieStore);

    const { searchParams } = new URL(request.url);
    const profil = searchParams.get("profil"); // particulier, entreprise, association, etudiant
    const situation = searchParams.get("situation"); // salarie, demandeur_emploi, independant, auto_entrepreneur, retraite, rsa, cej, etudiant
    const handicap = searchParams.get("handicap") === "true";
    const region = searchParams.get("region");

    // Base query — only active aides
    let query = supabase
      .from("aides")
      .select("*")
      .eq("active", true)
      .order("montant_max", { ascending: false });

    // If profil filter is provided, filter aides whose profil_eligible contains this profil
    if (profil) {
      query = query.contains("profil_eligible", [profil]);
    }

    // If situation filter is provided
    if (situation) {
      query = query.contains("situation_eligible", [situation]);
    }

    // Filter out handicap-only aides unless user has handicap
    if (!handicap) {
      query = query.eq("handicap_only", false);
    }

    // Region filter — show national + specific region
    if (region) {
      query = query.or(`region.eq.national,region.eq.${region}`);
    }

    const { data: aides, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Impossible de charger les aides" },
        { status: 500 }
      );
    }

    // Calculate cumul total
    const cumulTotal = (aides || []).reduce(
      (sum, aide) => sum + Number(aide.montant_max),
      0
    );

    return NextResponse.json({
      aides: aides || [],
      cumul_total: cumulTotal,
      count: (aides || []).length,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// POST /api/financer — create a dossier de financement
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServer(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Connecte-toi pour creer un dossier de financement" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { aide_id, metadata } = body;

    if (!aide_id) {
      return NextResponse.json(
        { error: "Selectionne une aide pour creer un dossier" },
        { status: 400 }
      );
    }

    // Check aide exists
    const { data: aide, error: aideError } = await supabase
      .from("aides")
      .select("*")
      .eq("id", aide_id)
      .single();

    if (aideError || !aide) {
      return NextResponse.json(
        { error: "Aide introuvable" },
        { status: 404 }
      );
    }

    // Check if dossier already exists for this aide
    const { data: existing } = await supabase
      .from("dossiers_financement")
      .select("id, statut")
      .eq("user_id", user.id)
      .eq("aide_id", aide_id)
      .in("statut", ["en_cours", "accepte"])
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Tu as deja un dossier en cours pour cette aide" },
        { status: 409 }
      );
    }

    // Create dossier
    const { data: dossier, error: insertError } = await supabase
      .from("dossiers_financement")
      .insert({
        user_id: user.id,
        aide_id,
        app_slug: "sutra",
        statut: "en_cours",
        metadata: metadata || {},
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Impossible de creer le dossier" },
        { status: 500 }
      );
    }

    return NextResponse.json({ dossier, aide });
  } catch {
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
