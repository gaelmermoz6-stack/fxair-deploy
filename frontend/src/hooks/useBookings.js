import { useState, useCallback } from 'react'
import { createBooking, getUserBookings, cancelBooking, estimatePrice } from '../lib/supabase'
import { sendBookingConfirmation } from '../lib/api'
import { useAuth } from './useAuth'

export function useBookings() {
  const { user } = useAuth()
  const [bookings, setBookings]   = useState([])
  const [bLoading, setBLoading]   = useState(false)
  const [bError, setBError]       = useState(null)

  const fetchBookings = useCallback(async () => {
    if (!user) return
    setBLoading(true)
    try {
      const data = await getUserBookings()
      setBookings(data)
    } catch (e) {
      setBError(e.message)
    } finally {
      setBLoading(false)
    }
  }, [user])

  const createFlight = useCallback(async (payload) => {
    setBLoading(true)
    setBError(null)
    try {
      const booking = await createBooking({
        ...payload,
        estimated_price: estimatePrice(payload.aircraft_class, payload.trip_type),
      })
      // Envoyer email de confirmation via Railway
      try { await sendBookingConfirmation(booking) } catch {}
      setBookings(prev => [booking, ...prev])
      return booking
    } catch (e) {
      setBError(e.message)
      throw e
    } finally {
      setBLoading(false)
    }
  }, [user])

  const cancel = useCallback(async (id) => {
    try {
      const updated = await cancelBooking(id)
      setBookings(prev => prev.map(b => b.id === id ? updated : b))
    } catch (e) {
      setBError(e.message)
    }
  }, [])

  return { bookings, bLoading, bError, fetchBookings, createFlight, cancel }
}
