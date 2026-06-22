// Supabase Edge Function — create a teacher account (admin only).
//
// Why an Edge Function? Creating an auth user requires the service_role key,
// which must NEVER live in the browser. This function runs server-side on
// Supabase, verifies the caller is a super_admin, then creates the account.
//
// Deploy (dashboard): Edge Functions → Deploy a new function → name it
// "create-teacher" → paste this file → Deploy. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { message: 'Méthode non autorisée.' });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1. Identify the caller from their JWT.
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return json(401, { message: 'Non authentifié.' });

    // 2. Verify the caller is a super_admin and find their school (tenant).
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, ecole_id')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (profile?.role !== 'super_admin') {
      return json(403, { message: "Accès réservé à l'administrateur." });
    }
    if (!profile.ecole_id) {
      return json(400, { message: "Votre compte n'est rattaché à aucune école." });
    }

    // 2b. Block writes when the trial has expired (school is read-only).
    const { data: ecole } = await supabase
      .from('ecole')
      .select('statut, essai_fin')
      .eq('id', profile.ecole_id)
      .maybeSingle();
    const today = new Date().toISOString().slice(0, 10);
    const active = !!ecole && (ecole.statut === 'actif'
      || (ecole.statut === 'essai' && (!ecole.essai_fin || ecole.essai_fin >= today)));
    if (!active) {
      return json(403, { message: "Période d'essai expirée. Activez votre abonnement pour ajouter des comptes." });
    }

    // 3. Validate the payload.
    const { nom, postnom, email, password } = await req.json();
    if (!nom || !email || !password) {
      return json(400, { message: 'Nom, email et mot de passe sont obligatoires.' });
    }
    if (String(password).length < 6) {
      return json(400, { message: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    // 4. Create the auth user (email pre-confirmed so they can log in now).
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) return json(400, { message: createErr.message });

    // 5. Create the matching profile (role = teacher, same school as the admin).
    const { error: profErr } = await supabase.from('profiles').insert({
      id: created.user.id,
      nom,
      postnom: postnom || null,
      email,
      role: 'teacher',
      ecole_id: profile.ecole_id,
    });
    if (profErr) {
      // Roll back the auth user if the profile insert failed.
      await supabase.auth.admin.deleteUser(created.user.id);
      return json(400, { message: profErr.message });
    }

    return json(200, { id: created.user.id });
  } catch (e) {
    return json(500, { message: String(e?.message || e) });
  }
});
