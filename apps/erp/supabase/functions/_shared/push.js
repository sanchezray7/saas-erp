// Helper compartido para enviar notificaciones push desde cualquier EF.
// Uso:
//   import { enviarPush } from '../_shared/push.js'
//   await enviarPush(admin, { user_id, title, body, url })

const SEND_PUSH_URL = '__SELF__' // Misma función, se resuelve vía fetch interno

export async function enviarPush(admin, { user_id, title, body, url, icon }) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id, title, body, url, icon }),
    })
  } catch (err) {
    console.error('[push] Error enviando push:', err.message)
  }
}
