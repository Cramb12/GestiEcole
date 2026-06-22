// Supabase Edge Function — self-service school signup (PUBLIC, no auth).
//
// Creates a new school (tenant) in 30-day trial mode plus its first super_admin
// account, atomically (rolls back on failure). Uses the service_role key, which
// must never live in the browser — hence an Edge Function.
//
// Deploy (dashboard): Edge Functions → Deploy a new function → name it
// "create-school" → paste this file → Deploy. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from 'npm:@supabase/supabase-js@2';

const TRIAL_DAYS = 30;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { message: 'Méthode non autorisée.' });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    const body = await req.json();
    const ecole = body?.ecole || {};
    const admin = body?.admin || {};

    // Validation.
    if (!ecole.nom_ecole || !ecole.annee_scolaire) {
      return json(400, { message: "Le nom de l'école et l'année scolaire sont obligatoires." });
    }
    if (!admin.nom || !admin.email || !admin.password) {
      return json(400, { message: 'Nom, email et mot de passe du directeur sont obligatoires.' });
    }
    if (String(admin.password).length < 6) {
      return json(400, { message: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    // 1. Create the school in trial mode.
    const essaiFin = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString().slice(0, 10);
    const { data: created, error: ecoleErr } = await supabase
      .from('ecole')
      .insert({
        nom_ecole: ecole.nom_ecole,
        province: ecole.province || null,
        ville: ecole.ville || null,
        commune: ecole.commune || null,
        code_ecole: ecole.code_ecole || null,
        annee_scolaire: ecole.annee_scolaire,
        statut: 'essai',
        essai_fin: essaiFin,
      })
      .select('id')
      .single();
    if (ecoleErr || !created) return json(400, { message: ecoleErr?.message || "Création de l'école impossible." });
    const ecoleId = created.id;

    // 2. Create the admin auth user.
    const { data: userData, error: userErr } = await supabase.auth.admin.createUser({
      email: admin.email,
      password: admin.password,
      email_confirm: true,
    });
    if (userErr || !userData.user) {
      await supabase.from('ecole').delete().eq('id', ecoleId);     // rollback
      const dup = String(userErr?.message || '').toLowerCase().includes('already');
      return json(400, { message: dup ? 'Cet email est déjà utilisé.' : (userErr?.message || 'Compte impossible.') });
    }

    // 3. Create the admin profile attached to the new school.
    const { error: profErr } = await supabase.from('profiles').insert({
      id: userData.user.id,
      nom: admin.nom,
      postnom: admin.postnom || null,
      email: admin.email,
      role: 'super_admin',
      ecole_id: ecoleId,
    });
    if (profErr) {
      await supabase.auth.admin.deleteUser(userData.user.id);      // rollback
      await supabase.from('ecole').delete().eq('id', ecoleId);
      return json(400, { message: profErr.message });
    }

    return json(200, { ecole_id: ecoleId, essai_fin: essaiFin });
  } catch (e) {
    return json(500, { message: String(e?.message || e) });
  }
});
