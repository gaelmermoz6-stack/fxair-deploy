require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const emailRoutes  = require('./routes/emails')
const stripeRoutes = require('./routes/stripe')

const app  = express()
const PORT = process.env.PORT || 4000

// ── Stripe webhook needs raw body ─────────────────
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }))

// ── Everything else ───────────────────────────────
app.use(express.json())
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ],
  credentials: true,
}))

// ── Routes ────────────────────────────────────────
app.use('/api/emails',  emailRoutes)
app.use('/api/stripe',  stripeRoutes)

// ── Health check (Railway uses this) ─────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date() }))

app.listen(PORT, () => {
  console.log(`✅ FXAIR Backend running on port ${PORT}`)
})
