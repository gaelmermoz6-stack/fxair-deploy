const express = require('express')
const { Resend } = require('resend')

const router = express.Router()
const resend = new Resend(process.env.RESEND_API_KEY)
const FROM   = process.env.EMAIL_FROM || 'FXAIR <noreply@fxair.com>'

// ── HTML TEMPLATES ────────────────────────────────────────────

function bookingHtml(b) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{background:#0a0a0a;color:#f0ece4;font-family:Georgia,serif;margin:0;padding:0}
    .w{max-width:600px;margin:0 auto;padding:48px 32px}
    .logo{font-size:26px;letter-spacing:8px;font-family:Arial,sans-serif;font-weight:700;margin-bottom:36px}
    .logo span{color:#c8aa6e}
    h1{font-size:34px;font-weight:300;margin:0 0 6px}
    .sub{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c8aa6e;margin-bottom:28px;display:block}
    .card{border:1px solid rgba(200,170,110,.25);padding:28px;margin:22px 0}
    .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(200,170,110,.1)}
    .row:last-child{border:none}
    .lbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;color:rgba(240,236,228,.45)}
    .val{font-size:16px;font-weight:300}
    .price{font-size:30px;font-weight:300;color:#c8aa6e;text-align:center;margin:22px 0}
    .btn{display:inline-block;background:#c8aa6e;color:#0a0a0a;padding:14px 32px;text-decoration:none;font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-top:22px}
    .ft{border-top:1px solid rgba(200,170,110,.15);margin-top:44px;padding-top:20px;font-size:11px;color:rgba(240,236,228,.35);font-family:Arial,sans-serif}
  </style></head><body><div class="w">
    <div class="logo">FX<span>AIR</span></div>
    <h1>Réservation <span style="color:#c8aa6e">Confirmée</span></h1>
    <span class="sub">Référence : ${String(b.id).slice(0, 8).toUpperCase()}</span>
    <p style="font-size:15px;line-height:1.9;color:rgba(240,236,228,.65);font-family:Arial,sans-serif;font-weight:300">
      Cher(e) ${b.contact_name || 'Client'}, merci de choisir FXAIR. Notre équipe aviation confirme votre vol dans les 2 heures.
    </p>
    <div class="card">
      <div class="row"><span class="lbl">Route</span><span class="val">${b.from_location} → ${b.to_location}</span></div>
      <div class="row"><span class="lbl">Départ</span><span class="val">${b.departure_date}</span></div>
      ${b.return_date ? `<div class="row"><span class="lbl">Retour</span><span class="val">${b.return_date}</span></div>` : ''}
      <div class="row"><span class="lbl">Passagers</span><span class="val">${b.passengers}</span></div>
      <div class="row"><span class="lbl">Appareil</span><span class="val">${b.aircraft_class || 'À confirmer'}</span></div>
      <div class="row"><span class="lbl">Type</span><span class="val">${b.trip_type}</span></div>
    </div>
    ${b.estimated_price ? `<div class="price">Est. $${Number(b.estimated_price).toLocaleString()}</div><p style="font-size:12px;color:rgba(240,236,228,.4);font-family:Arial,sans-serif;text-align:center">Prix final confirmé après vérification de disponibilité.</p>` : ''}
    <div style="text-align:center"><a href="https://fxair.com/dashboard" class="btn">Voir ma réservation</a></div>
    <div class="ft"><p>FXAIR · 605 Third Avenue, 36th Floor, New York, NY 10158</p><p>T: 1-866-726-1222 · charter@fxair.com</p><p style="margin-top:14px">© 2026 FXAIR. A Flexjet Company.</p></div>
  </div></body></html>`
}

function welcomeHtml(name) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{background:#0a0a0a;color:#f0ece4;font-family:Georgia,serif;margin:0;padding:0}
    .w{max-width:600px;margin:0 auto;padding:48px 32px}
    .logo{font-size:26px;letter-spacing:8px;font-family:Arial,sans-serif;font-weight:700;margin-bottom:36px}
    .logo span{color:#c8aa6e}
    h1{font-size:34px;font-weight:300;margin:0 0 24px}
    p{font-size:15px;line-height:1.9;color:rgba(240,236,228,.65);font-family:Arial,sans-serif;font-weight:300}
    .btn{display:inline-block;background:#c8aa6e;color:#0a0a0a;padding:14px 32px;text-decoration:none;font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-top:22px}
    .ft{border-top:1px solid rgba(200,170,110,.15);margin-top:44px;padding-top:20px;font-size:11px;color:rgba(240,236,228,.35);font-family:Arial,sans-serif}
  </style></head><body><div class="w">
    <div class="logo">FX<span>AIR</span></div>
    <h1>Bienvenue, <span style="color:#c8aa6e;font-style:italic">${name}</span></h1>
    <p>Votre compte FXAIR est prêt. Vous avez désormais accès au charter de jets privés à la demande, au plus haut standard de l'aviation.</p>
    <p>Réservez votre premier vol, explorez nos programmes de membership exclusifs, ou posez vos questions à notre concierge IA — disponible 24h/7j.</p>
    <a href="https://fxair.com" class="btn">Commencer à voler</a>
    <div class="ft"><p>FXAIR · 605 Third Avenue, New York, NY 10158 · 1-866-726-1222</p></div>
  </div></body></html>`
}

function membershipHtml(name, plan) {
  const planName = plan === 'aviator_plus' ? 'Aviator+' : 'Aviator'
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{background:#0a0a0a;color:#f0ece4;font-family:Georgia,serif;margin:0;padding:0}
    .w{max-width:600px;margin:0 auto;padding:48px 32px}
    .logo{font-size:26px;letter-spacing:8px;font-family:Arial,sans-serif;font-weight:700;margin-bottom:36px}
    .logo span{color:#c8aa6e}
    .badge{display:inline-block;border:1px solid #c8aa6e;color:#c8aa6e;padding:7px 22px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:28px}
    h1{font-size:34px;font-weight:300;margin:0 0 24px}
    p{font-size:15px;line-height:1.9;color:rgba(240,236,228,.65);font-family:Arial,sans-serif;font-weight:300}
    .btn{display:inline-block;background:#c8aa6e;color:#0a0a0a;padding:14px 32px;text-decoration:none;font-family:Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:700;margin-top:22px}
    .ft{border-top:1px solid rgba(200,170,110,.15);margin-top:44px;padding-top:20px;font-size:11px;color:rgba(240,236,228,.35);font-family:Arial,sans-serif}
  </style></head><body><div class="w">
    <div class="logo">FX<span>AIR</span></div>
    <div class="badge">Membre ${planName}</div>
    <h1>Bienvenue dans <span style="color:#c8aa6e;font-style:italic">${planName}</span></h1>
    <p>Félicitations ${name}. Votre membership ${planName} est maintenant actif. Vous bénéficiez d'un accès garanti aux appareils, de tarifs fixes et de l'ensemble des services premium FXAIR.</p>
    <p>Votre account manager dédié vous contactera dans les 24 heures pour vous présenter tous vos avantages.</p>
    <a href="https://fxair.com/dashboard" class="btn">Accéder à mon espace membre</a>
    <div class="ft"><p>FXAIR · 605 Third Avenue, New York, NY 10158 · 1-866-726-1222</p></div>
  </div></body></html>`
}

// ── ROUTES ────────────────────────────────────────────────────

// POST /api/emails/booking-confirmation
router.post('/booking-confirmation', async (req, res) => {
  try {
    const { booking } = req.body
    if (!booking?.contact_email) return res.status(400).json({ error: 'contact_email requis' })

    await resend.emails.send({
      from: FROM,
      to:   booking.contact_email,
      subject: `FXAIR — Réservation confirmée (${booking.from_location} → ${booking.to_location})`,
      html: bookingHtml(booking),
    })
    res.json({ success: true })
  } catch (e) {
    console.error('[email/booking]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// POST /api/emails/welcome
router.post('/welcome', async (req, res) => {
  try {
    const { name, email } = req.body
    if (!email) return res.status(400).json({ error: 'email requis' })

    await resend.emails.send({
      from: FROM,
      to:   email,
      subject: 'Bienvenue chez FXAIR — Votre compte est prêt',
      html: welcomeHtml(name || 'Client'),
    })
    res.json({ success: true })
  } catch (e) {
    console.error('[email/welcome]', e.message)
    res.status(500).json({ error: e.message })
  }
})

// POST /api/emails/membership
router.post('/membership', async (req, res) => {
  try {
    const { name, email, plan } = req.body
    if (!email || !plan) return res.status(400).json({ error: 'email et plan requis' })

    await resend.emails.send({
      from: FROM,
      to:   email,
      subject: `FXAIR — Membership ${plan === 'aviator_plus' ? 'Aviator+' : 'Aviator'} activé`,
      html: membershipHtml(name || 'Client', plan),
    })
    res.json({ success: true })
  } catch (e) {
    console.error('[email/membership]', e.message)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
