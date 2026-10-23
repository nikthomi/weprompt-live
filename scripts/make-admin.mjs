// Erste Admin-Person für WePrompt Live anlegen bzw. befördern.
// Aufruf: npm run admin -- info@deeds.ch
// Danach auf /passwort-vergessen die Adresse eingeben: Es kommt ein Link zum Passwort.
import { createClient } from '@supabase/supabase-js'

const email = (process.argv[2] ?? '').trim().toLowerCase()
if (!email.includes('@')) { console.error('E-Mail-Adresse fehlt.'); process.exit(1) }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let userId
const created = await db.auth.admin.createUser({ email, email_confirm: true })
if (created.data.user) userId = created.data.user.id
else if (created.error?.code === 'email_exists') userId = (await db.auth.admin.generateLink({ type: 'magiclink', email })).data.user?.id
if (!userId) { console.error(created.error?.message ?? 'Konto konnte nicht angelegt werden.'); process.exit(1) }

const { error } = await db.from('live_admins').upsert({ user_id: userId, email, role: 'admin' })
if (error) { console.error(error.message); process.exit(1) }
// Direktlink zum Passwort, damit es auch ohne Mailversand klappt (1 Stunde gültig).
const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://live.weprompt.ch').replace(/\/+$/, '')
const link = await db.auth.admin.generateLink({ type: 'recovery', email })
const hash = link.data.properties?.hashed_token
console.log(`${email} ist jetzt Admin von WePrompt Live.`)
if (hash) console.log(`Passwort festlegen (1 Stunde gültig): ${appUrl}/auth/confirm?token_hash=${hash}&type=recovery&next=/passwort-setzen`)
else console.log('Passwort festlegen über /passwort-vergessen.')
