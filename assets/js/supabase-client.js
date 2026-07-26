// =========================================================================
// Supabase client — safe to expose these values (that's what
// "publishable" means). RLS in the database is the real security boundary.
// Loaded via <script type="module"> on every page that needs data access.
// =========================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://azqixcnkhkzebufenbpx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_f_IldIzwwNR3Tlb0vfIDpQ_cW44oUly';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
