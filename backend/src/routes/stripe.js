const express = require('express')
const Stripe  = require('stripe')

const router = express.Router()
const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

const PRICES = {
  aviator:      process.env.STRIPE_PRICE_AVIATOR,
  aviator_plus: process.env.STRIPE_PRICE_AVIATOR_PLUS,
}

// ── POST /api/stripe/checkout ─────────────────────────────────
// Crée une session Stripe Checkout pour un membership
router.post('/checkout', async (req, res) => {
  try {
    const { plan, userId, email } = req.body
    const priceId = PRICES[plan]
    if (!priceId) return res.status(400).json({ error: `Plan inconnu : ${plan}` })

    const session = await stripe.checkout.sessions.create({
      mode:                  'subscription',
      payment_method_types:  ['card'],
      customer_email:        email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata:   { userId, plan },
      success_url: `${process.env.FRONTEND_URL}/dashboard?subscription=success`,
      cancel_url:  `${process.env.FRONTEND_URL}/memberships?cancelled=true`,
    })

    res.json({ url: session.url })
  } catch (e) {
    console.error('[stripe/checkout]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/stripe/payment-intent ──────────────────────────
// Paiement one-shot pour un vol
router.post('/payment-intent', async (req, res) => {
  try {
    const { bookingId, amount, email } = req.body
    if (!amount) return res.status(400).json({ error: 'amount requis' })

    const intent = await stripe.paymentIntents.create({
      amount:   Math.round(amount * 100), // en centimes
      currency: 'usd',
      receipt_email: email,
      metadata: { bookingId },
    })

    res.json({ clientSecret: intent.client_secret })
  } catch (e) {
    console.error('[stripe/payment-intent]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/stripe/portal ───────────────────────────────────
// Portail client Stripe pour gérer l'abonnement
router.post('/portal', async (req, res) => {
  try {
    const { stripeCustomerId } = req.body
    if (!stripeCustomerId) return res.status(400).json({ error: 'stripeCustomerId requis' })

    const session = await stripe.billingPortal.sessions.create({
      customer:   stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    })

    res.json({ url: session.url })
  } catch (e) {
    console.error('[stripe/portal]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── POST /api/stripe/webhook ──────────────────────────────────
// Reçoit les événements Stripe (paiement confirmé, abonnement annulé…)
// Corps RAW requis (configuré dans index.js)
router.post('/webhook', async (req, res) => {
  const sig     = req.headers['stripe-signature']
  const secret  = process.env.STRIPE_WEBHOOK_SECRET

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret)
  } catch (e) {
    console.error('[webhook] Signature invalide:', e.message)
    return res.status(400).send(`Webhook Error: ${e.message}`)
  }

  try {
    switch (event.type) {

      // Paiement membership réussi
      case 'checkout.session.completed': {
        const session = event.data.object
        const { userId, plan } = session.metadata || {}
        console.log(`✅ Membership activé — user:${userId} plan:${plan}`)

        // Mettre à jour Supabase via son API REST
        if (userId && plan) {
          await updateSupabaseMembership(userId, plan, session)
        }

        // Email de confirmation membership
        if (session.customer_email) {
          await fetch(`${process.env.FRONTEND_URL?.replace('5173','4000') || 'http://localhost:4000'}/api/emails/membership`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: session.customer_email,
              name:  session.customer_details?.name || 'Client',
              plan,
            }),
          }).catch(e => console.error('[webhook/email]', e.message))
        }
        break
      }

      // Abonnement annulé
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        console.log(`❌ Abonnement annulé — stripe_sub:${sub.id}`)
        await cancelSupabaseSubscription(sub.id)
        break
      }

      // Paiement de vol confirmé
      case 'payment_intent.succeeded': {
        const intent = event.data.object
        const { bookingId } = intent.metadata || {}
        if (bookingId) {
          console.log(`💳 Paiement vol confirmé — booking:${bookingId}`)
          await markBookingPaid(bookingId)
        }
        break
      }

      default:
        // Ignorer les autres événements
        break
    }
  } catch (e) {
    console.error('[webhook/handler]', e.message)
  }

  res.json({ received: true })
})

// ── HELPERS SUPABASE ──────────────────────────────────────────
// Appels directs à l'API REST de Supabase avec la service_role key

const SUPA_URL     = process.env.SUPABASE_URL
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

async function supabaseUpdate(table, updates, matchCol, matchVal) {
  if (!SUPA_URL || !SUPA_SERVICE) {
    console.warn('[supabase] Variables manquantes, mise à jour ignorée')
    return
  }
  const res = await fetch(
    `${SUPA_URL}/rest/v1/${table}?${matchCol}=eq.${matchVal}`,
    {
      method:  'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        SUPA_SERVICE,
        'Authorization': `Bearer ${SUPA_SERVICE}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(updates),
    }
  )
  if (!res.ok) {
    const txt = await res.text()
    console.error(`[supabase] PATCH ${table} failed:`, txt)
  }
}

async function supabaseInsert(table, data) {
  if (!SUPA_URL || !SUPA_SERVICE) return
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPA_SERVICE,
      'Authorization': `Bearer ${SUPA_SERVICE}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const txt = await res.text()
    console.error(`[supabase] POST ${table} failed:`, txt)
  }
}

async function updateSupabaseMembership(userId, plan, session) {
  // 1. Mettre à jour le profil
  await supabaseUpdate('profiles', { membership: plan }, 'id', userId)

  // 2. Récupérer l'abonnement Stripe pour les dates
  let subStart = new Date().toISOString()
  let subEnd   = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
  if (session.subscription) {
    try {
      const sub = await stripe.subscriptions.retrieve(session.subscription)
      subStart  = new Date(sub.current_period_start * 1000).toISOString()
      subEnd    = new Date(sub.current_period_end   * 1000).toISOString()
    } catch {}
  }

  // 3. Créer l'entrée subscription
  await supabaseInsert('subscriptions', {
    user_id:                userId,
    plan,
    status:                 'active',
    stripe_subscription_id: session.subscription,
    stripe_customer_id:     session.customer,
    current_period_start:   subStart,
    current_period_end:     subEnd,
  })
}

async function cancelSupabaseSubscription(stripeSubId) {
  await supabaseUpdate('subscriptions', { status: 'cancelled' }, 'stripe_subscription_id', stripeSubId)
}

async function markBookingPaid(bookingId) {
  await supabaseUpdate('bookings', {
    status:  'confirmed',
    paid_at: new Date().toISOString(),
  }, 'id', bookingId)
}

module.exports = router
