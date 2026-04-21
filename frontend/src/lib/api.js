// Toutes les requêtes vers le backend Railway
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const post = async (path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Erreur serveur' }))
    throw new Error(err.message || 'Erreur serveur')
  }
  return res.json()
}

// ── Emails ────────────────────────────────────────────────────
export const sendBookingConfirmation = (booking) =>
  post('/api/emails/booking-confirmation', { booking })

export const sendWelcomeEmail = (name, email) =>
  post('/api/emails/welcome', { name, email })

export const sendMembershipEmail = (name, email, plan) =>
  post('/api/emails/membership', { name, email, plan })

// ── Stripe ────────────────────────────────────────────────────
export const createCheckoutSession = (plan, userId, email) =>
  post('/api/stripe/checkout', { plan, userId, email })

export const createPaymentIntent = (bookingId, amount, email) =>
  post('/api/stripe/payment-intent', { bookingId, amount, email })
