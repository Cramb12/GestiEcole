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

const APP_URL = Deno.env.get('APP_URL') || 'https://www.gestiecole.com';
const MAIL_FROM = Deno.env.get('MAIL_FROM') || 'GestiEcole <noreply@gestiecole.com>';

// Send one transactional email via Resend. Never throws — email is best-effort
// and must not affect the signup outcome (non-blocking).
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

// DD/MM/YYYY for human-readable dates in emails.
const frDate = (iso: string) => iso.split('-').reverse().join('/');

// Escape user-supplied values before embedding them in the email HTML.
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

function welcomeEmail(nom: string, ecole: string, annee: string, essaiFin: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.5;max-width:600px">
  <p>Bonjour ${esc(nom)},</p>
  <p>Félicitations, l'école « <strong>${esc(ecole)}</strong> » est maintenant créée sur GestiEcole pour l'année scolaire ${esc(annee)}.</p>
  <p>Votre période d'essai gratuite de 30 jours est active jusqu'au <strong>${frDate(essaiFin)}</strong>. Vous avez accès à toutes les fonctionnalités, sans engagement.</p>
  <p><strong>Prochaines étapes pour bien démarrer :</strong></p>
  <ol>
    <li>Connectez-vous avec l'email et le mot de passe que vous avez choisis : <a href="${APP_URL}">${APP_URL}</a></li>
    <li>Vérifiez la structure déjà préparée (niveaux, périodes) et créez vos classes.</li>
    <li>Ajoutez vos enseignants — chacun recevra ses identifiants par email.</li>
    <li>Inscrivez vos élèves et commencez à saisir les notes.</li>
    <li>Configurez les frais scolaires si vous utilisez le module de perception.</li>
  </ol>
  <p>Besoin d'aide pour l'installation ou la formation ? Nous vous accompagnons gratuitement.<br>
  WhatsApp : +243 973 184 702<br>
  Email : gesti.ecole@gmail.com</p>
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

    // 4. Install the standard DRC structure (levels, periods, time slots) so the
    // school can create classes right away. Non-fatal if it fails.
    const { error: provErr } = await supabase.rpc('provision_school_structure', { eid: ecoleId });
    if (provErr) console.error('provision_school_structure', provErr.message);

    // 5. Welcome email with next steps (non-blocking — never affects the result).
    await sendEmail(
      admin.email,
      'Bienvenue sur GestiEcole — votre école est créée',
      welcomeEmail(admin.nom, ecole.nom_ecole, ecole.annee_scolaire, essaiFin),
    );

    return json(200, { ecole_id: ecoleId, essai_fin: essaiFin });
  } catch (e) {
    return json(500, { message: String(e?.message || e) });
  }
});
