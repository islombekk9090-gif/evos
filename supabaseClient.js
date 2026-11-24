const SUPABASE_URL = "https://fyawghlnrleehoktybhe.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_yNx3Oa6f52GBoeB_blDNtQ_12juRmQW";

if (!window.supabase) {
  console.error("Supabase JavaScript kutubxonasi yuklanmagan.");
  window.db = null;
} else {
  window.db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
}
