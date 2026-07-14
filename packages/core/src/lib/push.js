import { getSupabase } from './supabase'

export async function registrarPush() {
  const supabase = getSupabase()

  if (!('Notification' in window)) {
    console.warn('[push] Notificaciones no soportadas')
    return false
  }

  if (Notification.permission === 'denied') {
    console.warn('[push] Permiso denegado')
    return false
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  if (!('serviceWorker' in navigator)) return false

  const registration = await navigator.serviceWorker.ready

  // VAPID public key (en Base64 URL-safe)
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
  if (!vapidKey) {
    console.warn('[push] Falta VITE_VAPID_PUBLIC_KEY')
    return false
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  })

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      subscription,
      user_agent: navigator.userAgent,
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('[push] Error guardando suscripción:', error)
    return false
  }

  console.log('[push] Push registrado correctamente')
  return true
}

export async function desregistrarPush() {
  const supabase = getSupabase()

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) await subscription.unsubscribe()

  const user = (await supabase.auth.getUser()).data.user
  if (user) {
    await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}
