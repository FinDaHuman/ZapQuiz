import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';

// Client for the frontend (subject to RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for Next.js API routes (bypasses RLS to safely evaluate answers and fetch correct_answers)
export function getServiceSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_service_key';
  return createClient(supabaseUrl, serviceRoleKey);
}
