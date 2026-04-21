require('dotenv').config()
const express = require('express')
const cors = require('cors')

const emailRoutes = require('./routes/emails')
const stripeRoutes = require('./routes/stripe')

const app = express()

const PORT = process.env.PORT  // 🔥 IMPORTANT Railway

// Stripe webhook must be raw BEFORE json middleware
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }))

app.use(express.json())

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ],
  credentials: true,
}))

app.use('/api/emails', emailRoutes)
app.use('/api/stripe', stripeRoutes)

// Health check
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date() })
)

app.listen(PORT, () => {
  console.log(`✅ FXAIR Backend running on port ${PORT}`)
  console.log(`✅ FXAIR Backend running on port ${PORT}`)
})