// Prüft, ob ein anonymer Client den privaten Kanal einer Session abonnieren kann.
import { createClient } from '@supabase/supabase-js'
const [sessionId] = process.argv.slice(2)
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
await anon.realtime.setAuth()
const ch = anon.channel(`live:${sessionId}`, { config: { private: true } })
ch.on('broadcast', { event: 'state' }, m => { console.log('STATE', m.payload.version, m.payload.question?.title); process.exit(0) })
ch.subscribe((s, err) => console.log('status', s, err?.message ?? ''))
setTimeout(() => { console.log('timeout'); process.exit(1) }, 20000)
