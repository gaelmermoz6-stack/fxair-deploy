import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Variables Supabase manquantes dans .env')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── AUTH ──────────────────────────────────────────────────────
export const signUp = ({ email, password, fullName }) =>
  supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })

export const signIn = ({ email, password }) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getSession = async () => {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ── PROFILE ───────────────────────────────────────────────────
export const createProfile = async (userId, fullName, email) => {
  const { data, error } = await supabase
    .from('profiles')
    .insert([{ 
      id: userId, 
      full_name: fullName,
      email: email,
      membership: 'none',
      created_at: new Date().toISOString(),
    }])
    .select()
    .single()
  if (error) console.log('Profile creation:', error)
  return data ? { id: userId, full_name: fullName, email, membership: 'none' } : null
}

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles').update(updates).eq('id', userId).select().single()
  if (error) throw error
  return data
}

// ── BOOKINGS ──────────────────────────────────────────────────
export const createBooking = async (payload) => {
  const session = await getSession()
  const { data, error } = await supabase
    .from('bookings')
    .insert({ ...payload, user_id: session?.user?.id ?? null })
    .select().single()
  if (error) throw error
  return data
}

export const getUserBookings = async () => {
  const session = await getSession()
  if (!session) return []
  const { data, error } = await supabase
    .from('bookings').select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const cancelBooking = async (id) => {
  const { data, error } = await supabase
    .from('bookings').update({ status: 'cancelled' }).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── CONTACT ───────────────────────────────────────────────────
export const submitContact = async (payload) => {
  const session = await getSession()
  const { data, error } = await supabase
    .from('contact_messages')
    .insert({ ...payload, user_id: session?.user?.id ?? null })
    .select().single()
  if (error) throw error
  return data
}

// ── PRICE ESTIMATE ────────────────────────────────────────────
const BASE_RATES = {
  Light: 4500, Midsize: 7500, 'Super-midsize': 9500,
  Large: 14000, 'Ultra-Long-Range': 22000, Helicopter: 3500,
}
export const estimatePrice = (cls, tripType) =>
  Math.round((BASE_RATES[cls] ?? 7500) * (tripType === 'round-trip' ? 1.85 : 1))
