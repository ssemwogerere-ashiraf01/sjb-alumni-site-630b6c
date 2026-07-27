import { supabase } from './supabase-client.js';
import { BASE_URL } from './site-config.js';

export async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = `${BASE_URL}/login.html`; return null; }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (!profile || profile.role !== 'admin') {
    window.location.href = `${BASE_URL}/dashboard.html`;
    return null;
  }
  return profile;
}

// Stricter guard for the super-admin-only dashboard: role changes and
// permanent account deletion live behind this, not requireAdmin().
export async function requireSuperAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = `${BASE_URL}/login.html`; return null; }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (!profile || !profile.is_super_admin) {
    window.location.href = `${BASE_URL}/admin/index.html`;
    return null;
  }
  return profile;
}
