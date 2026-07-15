import { createClient } from "@supabase/supabase-js";

// Nilai diambil dari file .env.local (lihat .env.example)
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn(
    "[Samudra] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi di .env.local"
  );
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
});
