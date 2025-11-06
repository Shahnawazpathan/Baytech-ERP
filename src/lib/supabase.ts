import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://kqdwgfrfgctacmwdykmq.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZHdnZnJmZ2N0YWNtd2R5a21xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNTAzNjUsImV4cCI6MjA3NzkyNjM2NX0.xN5UMcDulpgYfCgsJ2yUGEEoE5ADkdb83Kl-7dLA_sQ"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
