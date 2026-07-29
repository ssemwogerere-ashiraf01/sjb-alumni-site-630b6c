/**
 * Member presence:
 * 1) Heartbeat RPC → profiles.last_seen_at (survives refresh; admin SQL queries)
 * 2) Supabase Realtime Presence channel "online-members" (live in-memory map)
 */
import { supabase } from './supabase-client.js';

const HEARTBEAT_MS = 45_000;
const CHANNEL = 'online-members';

let heartbeatTimer = null;
let presenceChannel = null;
let startedForUser = null;

function currentPath() {
  try {
    return (window.location.pathname + window.location.search).slice(0, 200);
  } catch {
    return '/';
  }
}

async function sendHeartbeat() {
  try {
    await supabase.rpc('heartbeat', { p_path: currentPath() });
  } catch (e) {
    console.warn('heartbeat failed', e);
  }
}

/**
 * Start presence for the logged-in user (safe to call multiple times).
 * @param {{ id: string, full_name?: string, profile_photo_url?: string, role?: string }} profile
 */
export async function startPresence(profile) {
  if (!profile?.id) return;
  if (startedForUser === profile.id && presenceChannel) {
    await sendHeartbeat();
    return;
  }
  await stopPresence();
  startedForUser = profile.id;

  await sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS);

  // Also on visibility / focus
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('focus', sendHeartbeat);

  try {
    presenceChannel = supabase.channel(CHANNEL, {
      config: { presence: { key: profile.id } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        window.dispatchEvent(new CustomEvent('presence:sync', { detail: state }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: profile.id,
            full_name: profile.full_name || 'Member',
            profile_photo_url: profile.profile_photo_url || null,
            role: profile.role || 'member',
            path: currentPath(),
            online_at: new Date().toISOString(),
          });
        }
      });
  } catch (e) {
    console.warn('Realtime Presence unavailable', e);
  }
}

function onVis() {
  if (document.visibilityState === 'visible') sendHeartbeat();
}

export async function stopPresence() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  document.removeEventListener('visibilitychange', onVis);
  window.removeEventListener('focus', sendHeartbeat);
  if (presenceChannel) {
    try {
      await supabase.removeChannel(presenceChannel);
    } catch { /* ignore */ }
    presenceChannel = null;
  }
  startedForUser = null;
}

/** Flatten presence state → array of tracked payloads */
export function presenceListFromState(state) {
  const out = [];
  if (!state) return out;
  for (const key of Object.keys(state)) {
    const metas = state[key] || [];
    if (metas[0]) out.push({ ...metas[0], presence_key: key });
  }
  return out;
}
