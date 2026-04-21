import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { supabase, getProfile, signIn, signOut } from '../lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { sendWelcomeEmail } from '../lib/api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (u) => {
    try {
      const p = await getProfile(u.id)
      setProfile(p)
    } catch (err) {
      console.log('Erreur chargement profil:', err)
      
      // Fallback : créer le profil manuellement s'il n'existe pas
      try {
        const fullName = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Utilisateur'
        const { data: inserted } = await supabase
          .from('profiles')
          .insert([{
            id: u.id,
            full_name: fullName,
            phone: null,
            membership: 'none',
          }])
          .select()
          .single()
        
        if (inserted) {
          setProfile(inserted)
        } else {
          // Fallback final : utiliser les métadonnées de l'utilisateur
          setProfile({ 
            id: u.id, 
            full_name: u.user_metadata?.full_name || 'Utilisateur', 
            phone: null,
            membership: 'none' 
          })
        }
      } catch (insertErr) {
        console.log('Erreur création profil:', insertErr)
        // Ultième fallback : utiliser les métadonnées
        setProfile({ 
          id: u.id, 
          full_name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Utilisateur', 
          phone: null,
          membership: 'none' 
        })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) loadProfile(u)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) loadProfile(u)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const login = async (email, password) => {
    const { data, error } = await signIn({ email, password })
    if (error) throw error
    
    // Charger le profil après connexion
    if (data.user) {
      await loadProfile(data.user)
    }
    
    return data
  }

  const register = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { 
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    
    // Créer le profil manuellement comme backup du trigger
    if (data.user) {
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .insert([{
            id: data.user.id,
            full_name: fullName,
            phone: null,
            membership: 'none',
          }])
          .select()
          .single()
        
        if (profileData) {
          setProfile(profileData)
        }
      } catch (err) {
        console.log('Profile auto-création (non-critique):', err)
        // Pas grave si ça échoue, le trigger devrait l'avoir créé
      }
    }
    
    // Email de bienvenue via Railway
    try { await sendWelcomeEmail(fullName, email) } catch {}
    return data
  }

  const logout = async () => {
    await signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthCtx.Provider value={{ user, profile, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
