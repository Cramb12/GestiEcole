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

const APP_URL = Deno.env.get('APP_URL') || 'https://www.gestiecole.com';
const MAIL_FROM = Deno.env.get('MAIL_FROM') || 'GestiEcole <noreply@gestiecole.com>';

// Send one transactional email via Resend. Never throws — email is best-effort
// and must not affect account creation (non-blocking).
async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) { console.warn('RESEND_API_KEY manquant — email ignoré.'); return; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to, subject, html }),
    });
    if (!r.ok) console.error('Resend', r.status, await r.text());
  } catch (e) {
    console.error('Resend exception', String((e as Error)?.message || e));
  }
}

// Escape user-supplied values before embedding them in the email HTML.
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

function credentialsEmail(nom: string, ecole: string, email: string, password: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.5;max-width:600px">
  <p>Bonjour ${esc(nom)},</p>
  <p>Un compte enseignant a été créé pour vous sur GestiEcole par la direction de « <strong>${esc(ecole)}</strong> ».</p>
  <p><strong>Voici vos identifiants de connexion :</strong></p>
  <p style="background:#f4f4f5;padding:12px 16px;border-radius:6px">
    Adresse : <a href="${APP_URL}">${APP_URL}</a><br>
    Email : <strong>${esc(email)}</strong><br>
    Mot de passe : <strong>${esc(password)}</strong>
  </p>
  <p><strong>Important :</strong> gardez ces identifiants secrets et ne les partagez avec personne. Ils donnent accès aux notes et aux données des élèves dont vous avez la charge.</p>
  <p>Pour toute question, contactez la direction de votre école.</p>
  <p>L'équipe GestiEcole</p>
</div>`;
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
      .select('statut, essai_fin, nom_ecole')
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

    // 6. Email the login details to the teacher (non-blocking — never affects
    // the result). This is the only moment the password exists in the clear.
    await sendEmail(
      email,
      'Vos identifiants de connexion — GestiEcole',
      credentialsEmail(nom, ecole?.nom_ecole || 'votre école', email, password),
    );

    return json(200, { id: created.user.id });
  } catch (e) {
    return json(500, { message: String(e?.message || e) });
  }
});
