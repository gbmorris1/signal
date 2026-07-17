// Supabase Edge Function: delete-account
// Permanently deletes the authenticated user and all their data. Required by
// App Store guideline 5.1.1(v) for any app that supports account creation.
//
// Deploy: supabase functions deploy delete-account
//
// The user's rows (profile, watchlists, alerts, subscriptions, ai_usage) all
// cascade from users -> auth.users, so deleting the auth user removes everything.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) {
    console.error('delete user failed:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
