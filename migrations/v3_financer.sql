-- ============================================
-- SUTRA V3 — /financer tables + seed 45 aides
-- ============================================

-- Table des aides au financement
CREATE TABLE IF NOT EXISTS sutra.aides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type_aide TEXT NOT NULL CHECK (type_aide IN ('particulier', 'entreprise', 'association')),
  profil_eligible TEXT[] NOT NULL DEFAULT '{}',
  situation_eligible TEXT[] NOT NULL DEFAULT '{}',
  montant_max NUMERIC(10,2) NOT NULL DEFAULT 0,
  taux_remboursement INTEGER DEFAULT 100,
  url_officielle TEXT,
  description TEXT NOT NULL,
  region TEXT DEFAULT 'national',
  handicap_only BOOLEAN DEFAULT false,
  cumulable BOOLEAN DEFAULT true,
  renouvellement_auto BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table des dossiers de financement
CREATE TABLE IF NOT EXISTS sutra.dossiers_financement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  aide_id UUID REFERENCES sutra.aides(id) ON DELETE CASCADE,
  app_slug TEXT DEFAULT 'sutra',
  statut TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'accepte', 'refuse', 'renouveler')),
  date_demande TIMESTAMPTZ DEFAULT now(),
  date_reponse TIMESTAMPTZ,
  date_expiration TIMESTAMPTZ,
  pdf_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE sutra.aides ENABLE ROW LEVEL SECURITY;
ALTER TABLE sutra.dossiers_financement ENABLE ROW LEVEL SECURITY;

-- Aides: lecture publique
CREATE POLICY "aides_select_all" ON sutra.aides FOR SELECT USING (true);

-- Dossiers: utilisateur voit ses propres dossiers
CREATE POLICY "dossiers_select_own" ON sutra.dossiers_financement FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dossiers_insert_own" ON sutra.dossiers_financement FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dossiers_update_own" ON sutra.dossiers_financement FOR UPDATE USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_dossiers_user ON sutra.dossiers_financement(user_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_aide ON sutra.dossiers_financement(aide_id);
CREATE INDEX IF NOT EXISTS idx_aides_type ON sutra.aides(type_aide);
CREATE INDEX IF NOT EXISTS idx_aides_active ON sutra.aides(active);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION sutra.update_dossiers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_dossiers_timestamp ON sutra.dossiers_financement;
CREATE TRIGGER set_dossiers_timestamp
  BEFORE UPDATE ON sutra.dossiers_financement
  FOR EACH ROW EXECUTE FUNCTION sutra.update_dossiers_timestamp();

-- ============================================
-- SEED 45 AIDES
-- ============================================

-- PARTICULIERS (20)
INSERT INTO sutra.aides (nom, type_aide, profil_eligible, situation_eligible, montant_max, taux_remboursement, url_officielle, description, region, handicap_only) VALUES
('CPF - Compte Personnel de Formation', 'particulier', '{particulier}', '{salarie,independant,demandeur_emploi}', 5000, 100, 'https://www.moncompteformation.gouv.fr', 'Financez votre formation aux outils video IA avec votre CPF. Jusqu''a 5 000 EUR mobilisables.', 'national', false),
('AIF - Aide Individuelle a la Formation', 'particulier', '{particulier}', '{demandeur_emploi}', 8000, 100, 'https://www.pole-emploi.fr/candidat/en-formation/les-aides-a-la-formation/aide-individuelle-a-la-formation.html', 'France Travail finance votre formation video IA si elle debouche sur un emploi.', 'national', false),
('Cheque Formation CAF', 'particulier', '{particulier}', '{rsa,salarie,demandeur_emploi}', 500, 100, 'https://www.caf.fr', 'Aide de la CAF pour financer des formations numeriques. Selon votre quotient familial.', 'national', false),
('Pass Numerique', 'particulier', '{particulier}', '{salarie,demandeur_emploi,retraite,rsa}', 20, 100, 'https://www.pass-numerique.gouv.fr', 'Cheques de 10 a 20 EUR pour acceder aux outils numeriques. Cumulable.', 'national', false),
('Prime d''Activite', 'particulier', '{particulier}', '{salarie,auto_entrepreneur}', 500, 100, 'https://www.caf.fr/allocataires/droits-et-prestations/s-informer-sur-les-aides/solidarite-et-insertion/la-prime-d-activite', 'Complement de revenus pour travailleurs modestes. Peut couvrir un abonnement.', 'national', false),
('AGEFIPH - Aide Handicap', 'particulier', '{particulier}', '{salarie,demandeur_emploi,independant}', 10000, 100, 'https://www.agefiph.fr', 'Aide pour l''acces aux outils numeriques et la creation de contenu pour les personnes handicapees.', 'national', true),
('FIPHFP - Fonction Publique Handicap', 'particulier', '{particulier}', '{salarie}', 5000, 100, 'https://www.fiphfp.fr', 'Aide aux agents publics en situation de handicap pour s''equiper en outils numeriques.', 'national', true),
('Aide Mobilite Jeunes', 'particulier', '{particulier,etudiant}', '{demandeur_emploi,etudiant}', 1000, 100, 'https://www.1jeune1solution.gouv.fr', 'Aide a la mobilite pour les jeunes en formation ou recherche d''emploi.', 'national', false),
('Bourse CROUS', 'particulier', '{etudiant}', '{etudiant}', 600, 100, 'https://www.messervices.etudiant.gouv.fr', 'Bourse etudiante pouvant couvrir l''acces aux outils de creation video.', 'national', false),
('Pass Culture', 'particulier', '{particulier,etudiant}', '{etudiant}', 300, 100, 'https://pass.culture.fr', '300 EUR pour les 15-20 ans pour acceder a des contenus culturels et creatifs numeriques.', 'national', false),
('Micro-credit Personnel', 'particulier', '{particulier}', '{rsa,demandeur_emploi,salarie}', 5000, 100, 'https://www.france-microcredit.org', 'Pret a taux zero pour financer un projet de creation de contenu video.', 'national', false),
('OPCO - Operateur de Competences', 'particulier', '{particulier}', '{salarie}', 3000, 100, 'https://www.opco.fr', 'Votre OPCO finance vos formations en creation de contenu et video IA.', 'national', false),
('1 Jeune 1 Solution', 'particulier', '{particulier,etudiant}', '{demandeur_emploi,etudiant}', 500, 100, 'https://www.1jeune1solution.gouv.fr', 'Plateforme regroupant toutes les aides pour les jeunes. Formations et aides financieres.', 'national', false),
('Garantie Jeunes / CEJ', 'particulier', '{particulier}', '{demandeur_emploi}', 500, 100, 'https://www.1jeune1solution.gouv.fr/contrat-engagement-jeune', 'Allocation mensuelle jusqu''a 500 EUR pour les 16-25 ans en insertion. Couvre outils numeriques.', 'national', false),
('PLIE - Plan Local Insertion Emploi', 'particulier', '{particulier}', '{demandeur_emploi,rsa}', 2000, 100, 'https://www.emploi.gouv.fr', 'Accompagnement et financement local pour l''insertion par le numerique.', 'national', false),
('RSA - Revenu de Solidarite Active', 'particulier', '{particulier}', '{rsa}', 607, 100, 'https://www.service-public.fr/particuliers/vosdroits/N19775', 'Le RSA couvre les besoins essentiels. Des complements existent pour la formation.', 'national', false),
('FNE-Formation', 'particulier', '{particulier}', '{salarie}', 5000, 100, 'https://travail-emploi.gouv.fr/emploi-et-formation/formation/fne-formation', 'Prise en charge a 100% des formations pour les salaries en activite partielle ou en reconversion.', 'national', false),
('Transition Pro', 'particulier', '{particulier}', '{salarie}', 10000, 100, 'https://www.transitionspro.fr', 'Financement integral de votre reconversion vers les metiers de la creation video IA.', 'national', false),
('VAE - Validation des Acquis', 'particulier', '{particulier}', '{salarie,independant,demandeur_emploi}', 3000, 100, 'https://www.vae.gouv.fr', 'Faites valider vos competences en creation video. Accompagnement finance.', 'national', false),
('Pole Emploi Numerique', 'particulier', '{particulier}', '{demandeur_emploi}', 1500, 100, 'https://www.pole-emploi.fr', 'Aides specifiques de France Travail pour les formations au numerique et a l''IA.', 'national', false);

-- ENTREPRISES (15)
INSERT INTO sutra.aides (nom, type_aide, profil_eligible, situation_eligible, montant_max, taux_remboursement, url_officielle, description, region, handicap_only) VALUES
('France Num - Cheque Numerique', 'entreprise', '{entreprise,auto_entrepreneur}', '{independant,auto_entrepreneur}', 6500, 50, 'https://www.francenum.gouv.fr', 'Subvention de 6 500 EUR pour digitaliser votre communication video. TPE/PME.', 'national', false),
('Pack IA Entreprise', 'entreprise', '{entreprise}', '{independant,auto_entrepreneur,salarie}', 18500, 80, 'https://www.bpifrance.fr', 'Programme BPI pour integrer l''IA dans votre strategie de contenu. Jusqu''a 80% pris en charge.', 'national', false),
('OPCO IA - Formation Entreprise', 'entreprise', '{entreprise,auto_entrepreneur}', '{salarie,independant}', 5000, 100, 'https://www.opco.fr', 'Formation IA et creation video financee par votre OPCO. Salaries et dirigeants.', 'national', false),
('BFC Numerique', 'entreprise', '{entreprise,auto_entrepreneur}', '{independant,auto_entrepreneur}', 3000, 50, 'https://www.bourgognefranchecomte.fr', 'Aide regionale Bourgogne-Franche-Comte pour la numerisation des entreprises.', 'Bourgogne-Franche-Comte', false),
('CIR - Credit Impot Recherche', 'entreprise', '{entreprise}', '{independant}', 100000, 30, 'https://www.enseignementsup-recherche.gouv.fr/fr/le-credit-d-impot-recherche', 'Deduction de 30% des depenses en R&D liees a l''IA et la creation video.', 'national', false),
('CII - Credit Impot Innovation', 'entreprise', '{entreprise}', '{independant}', 80000, 20, 'https://www.bpifrance.fr/catalogue-offres/credit-impot-innovation', 'Credit d''impot de 20% pour les PME innovantes dans le domaine de la video IA.', 'national', false),
('FNE IA - Formation IA Entreprise', 'entreprise', '{entreprise}', '{salarie}', 10000, 100, 'https://travail-emploi.gouv.fr', 'Prise en charge integrale des formations IA pour les entreprises en mutation.', 'national', false),
('Cheque TPE CCI', 'entreprise', '{entreprise,auto_entrepreneur}', '{independant,auto_entrepreneur}', 1500, 50, 'https://www.cci.fr', 'Aide CCI pour accompagner les TPE dans leur transition numerique video.', 'national', false),
('AGEFIPH Entreprise', 'entreprise', '{entreprise}', '{salarie}', 10000, 100, 'https://www.agefiph.fr/aides-handicap/aide-a-ladaptation-des-situations-de-travail', 'Aide pour adapter les postes de travail avec des outils IA. Entreprises employant des TH.', 'national', true),
('DIRECCTE - Aide Numerique', 'entreprise', '{entreprise}', '{independant}', 5000, 50, 'https://dreets.gouv.fr', 'Aide DREETS pour la transformation numerique des PME.', 'national', false),
('Diagnostic BFC 50%', 'entreprise', '{entreprise}', '{independant}', 3000, 50, 'https://www.bourgognefranchecomte.fr', 'Diagnostic numerique finance a 50% par la region BFC.', 'Bourgogne-Franche-Comte', false),
('BPI France - Pret Numerique', 'entreprise', '{entreprise}', '{independant}', 300000, 100, 'https://www.bpifrance.fr', 'Pret de 10 000 a 300 000 EUR pour financer votre transformation video IA.', 'national', false),
('DETR - Dotation Equipement Territoires', 'entreprise', '{entreprise}', '{independant}', 50000, 80, 'https://www.collectivites-locales.gouv.fr', 'Subvention pour les investissements numeriques en zone rurale.', 'national', false),
('FEDER - Fonds Europeen', 'entreprise', '{entreprise}', '{independant}', 100000, 50, 'https://www.europe-en-france.gouv.fr', 'Fonds europeens pour les projets de numerisation et d''innovation.', 'national', false),
('Aide Sante Numerique', 'entreprise', '{entreprise}', '{independant,salarie}', 15000, 100, 'https://www.sante.gouv.fr', 'Programme de numerisation du secteur sante. Creation de contenu medical video IA.', 'national', false);

-- ASSOCIATIONS (10)
INSERT INTO sutra.aides (nom, type_aide, profil_eligible, situation_eligible, montant_max, taux_remboursement, url_officielle, description, region, handicap_only) VALUES
('FDVA 2 - Fonctionnement', 'association', '{association}', '{independant}', 15000, 100, 'https://www.associations.gouv.fr/fdva.html', 'Subvention pour le fonctionnement des associations. Communication video incluse.', 'national', false),
('FDVA 3 - Innovation', 'association', '{association}', '{independant}', 10000, 100, 'https://www.associations.gouv.fr/fdva.html', 'Aide a l''innovation associative. Projet de creation video IA.', 'national', false),
('Subvention Communale', 'association', '{association}', '{independant}', 5000, 100, 'https://www.service-public.fr', 'Subvention de la commune pour les projets associatifs de communication.', 'national', false),
('LEADER - Fonds Rural', 'association', '{association}', '{independant}', 20000, 80, 'https://www.europe-en-france.gouv.fr', 'Programme LEADER pour le developpement des associations en zone rurale.', 'national', false),
('Aide Departementale', 'association', '{association}', '{independant}', 8000, 100, 'https://www.departement.fr', 'Subvention du departement pour les projets associatifs numeriques.', 'national', false),
('Aide Region BFC', 'association', '{association}', '{independant}', 10000, 100, 'https://www.bourgognefranchecomte.fr', 'Aide regionale BFC pour les associations. Projets de communication video.', 'Bourgogne-Franche-Comte', false),
('Fondation de France', 'association', '{association}', '{independant}', 15000, 100, 'https://www.fondationdefrance.org', 'Subvention pour les projets associatifs innovants. Communication et creation video.', 'national', false),
('Mecenat d''Entreprise 60%', 'association', '{association}', '{independant}', 50000, 60, 'https://www.associations.gouv.fr/le-mecenat.html', 'Les entreprises mecenes financent votre projet video et deduisent 60% de l''IS.', 'national', false),
('Google Ad Grants', 'association', '{association}', '{independant}', 10000, 100, 'https://www.google.com/grants/', '10 000 USD/mois en publicite Google pour les associations. Promouvez vos videos.', 'national', false),
('France Active', 'association', '{association}', '{independant}', 30000, 100, 'https://www.franceactive.org', 'Accompagnement et financement solidaire pour les associations.', 'national', false);
