# 🛩️ FXAIR — Guide de Déploiement Complet

## Architecture
```
Frontend (React + Vite)  →  Vercel
Backend  (Node/Express)  →  Railway
Base de données + Auth   →  Supabase
Paiements                →  Stripe
Emails                   →  Resend
```

---

## ÉTAPE 1 — Supabase (Base de données + Auth)

### 1a. Créer le projet
1. Aller sur https://app.supabase.com → **New Project**
2. Notez votre **Project URL** et **anon key** (Settings → API)
3. Notez aussi la **service_role key** (pour le backend)

### 1b. Exécuter le SQL
Supabase Dashboard → **SQL Editor** → Coller et exécuter :

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name   TEXT,
  phone       TEXT,
  membership  TEXT DEFAULT 'none',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.bookings (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID REFERENCES public.profiles(id),
  trip_type       TEXT NOT NULL,
  from_location   TEXT NOT NULL,
  to_location     TEXT NOT NULL,
  departure_date  DATE NOT NULL,
  return_date     DATE,
  passengers      INTEGER DEFAULT 1,
  aircraft_class  TEXT,
  contact_name    TEXT,
  contact_email   TEXT NOT NULL,
  contact_phone   TEXT,
  status          TEXT DEFAULT 'pending',
  estimated_price NUMERIC(12,2),
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.subscriptions (
  id                     UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id                UUID REFERENCES public.profiles(id),
  plan                   TEXT NOT NULL,
  status                 TEXT DEFAULT 'active',
  stripe_subscription_id TEXT,
  stripe_customer_id     TEXT,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.contact_messages (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger : crée un profil automatiquement à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row Level Security
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile"   ON public.profiles         FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_bookings"  ON public.bookings         FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "own_subs"      ON public.subscriptions    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "insert_contact" ON public.contact_messages FOR INSERT WITH CHECK (TRUE);
```

### 1c. Configurer Auth
- Supabase → **Authentication → Settings**
- **Site URL** : `https://fxair.vercel.app` (votre URL Vercel)
- **Redirect URLs** : `https://fxair.vercel.app/**`

---

## ÉTAPE 2 — Stripe (Paiements)

### 2a. Créer les produits
https://dashboard.stripe.com → Products → **Add Product**

| Produit      | Prix        | Type       | Fréquence |
|-------------|-------------|------------|-----------|
| FXAIR Aviator  | $150,000 | Recurring  | Yearly    |
| FXAIR Aviator+ | $350,000 | Recurring  | Yearly    |

Copiez les **Price IDs** (format `price_xxx`)

### 2b. Webhook Stripe
- Stripe → **Developers → Webhooks → Add endpoint**
- URL : `https://VOTRE-APP.railway.app/api/stripe/webhook`
- Événements à sélectionner :
  - `checkout.session.completed`
  - `customer.subscription.deleted`
  - `payment_intent.succeeded`
- Copiez le **Webhook signing secret** (`whsec_xxx`)

---

## ÉTAPE 3 — Resend (Emails)
1. https://resend.com → Créer un compte
2. **API Keys** → Create API Key → copiez `re_xxx`
3. **Domains** → Add Domain → vérifiez votre domaine (ou utilisez `@resend.dev` pour les tests)

---

## ÉTAPE 4 — Déployer le Backend sur Railway

### 4a. Créer le projet Railway
1. https://railway.app → **New Project → Deploy from GitHub**
2. Connectez votre repo GitHub (ou uploadez le dossier `backend/`)
3. Sélectionnez le dossier `backend` comme root directory

### 4b. Variables d'environnement Railway
Railway Dashboard → Votre service → **Variables** → Ajoutez :

```
STRIPE_SECRET_KEY        = sk_live_...
STRIPE_WEBHOOK_SECRET    = whsec_...
STRIPE_PRICE_AVIATOR     = price_...
STRIPE_PRICE_AVIATOR_PLUS= price_...
RESEND_API_KEY           = re_...
EMAIL_FROM               = FXAIR <noreply@fxair.com>
SUPABASE_URL             = https://XXXXX.supabase.co
SUPABASE_SERVICE_ROLE_KEY= eyJhbGc...
FRONTEND_URL             = https://fxair.vercel.app
```

### 4c. Vérifier le déploiement
Une fois déployé, Railway vous donne une URL : `https://fxair-backend-xxx.railway.app`
Testez : `https://fxair-backend-xxx.railway.app/health` → doit retourner `{"status":"ok"}`

---

## ÉTAPE 5 — Déployer le Frontend sur Vercel

### 5a. Créer le projet Vercel
1. https://vercel.com → **New Project → Import Git Repository**
2. Sélectionnez le dossier `frontend/` comme root directory
3. Framework : **Vite**

### 5b. Variables d'environnement Vercel
Vercel → Votre projet → **Settings → Environment Variables** :

```
VITE_SUPABASE_URL         = https://XXXXX.supabase.co
VITE_SUPABASE_ANON_KEY    = eyJhbGc...  (anon key, pas service role!)
VITE_STRIPE_PUBLISHABLE_KEY = pk_live_...
VITE_API_URL              = https://fxair-backend-xxx.railway.app
```

### 5c. Redéployer
Vercel → **Deployments → Redeploy** (pour appliquer les variables)

---

## ÉTAPE 6 — Mettre à jour le Webhook Stripe
Maintenant que vous avez l'URL Railway, mettez à jour l'URL du webhook dans Stripe :
`https://fxair-backend-xxx.railway.app/api/stripe/webhook`

---

## Flux complet de données

```
Utilisateur remplit le formulaire
  → BookingForm (React)
  → createFlight() [useBookings.js]
  → INSERT bookings (Supabase)
  → POST /api/emails/booking-confirmation (Railway)
  → Resend API → Email au client ✅

Utilisateur clique "Rejoindre Aviator+"
  → MembershipsPage (React)
  → createCheckoutSession() [api.js]
  → POST /api/stripe/checkout (Railway)
  → Stripe Checkout Page
  → Paiement réussi
  → Stripe Webhook → POST /api/stripe/webhook (Railway)
  → UPDATE profiles.membership (Supabase)
  → INSERT subscriptions (Supabase)
  → POST /api/emails/membership (Railway)
  → Resend API → Email de confirmation ✅
```

---

## Structure des fichiers

```
fxair/
├── frontend/                 → Déployer sur Vercel
│   ├── src/
│   │   ├── App.jsx           ← Application principale
│   │   ├── main.jsx          ← Entry point React
│   │   ├── hooks/
│   │   │   ├── useAuth.js    ← Auth context
│   │   │   └── useBookings.js← Gestion réservations
│   │   └── lib/
│   │       ├── supabase.js   ← Client Supabase + helpers DB
│   │       └── api.js        ← Appels vers Railway backend
│   ├── index.html
│   ├── vite.config.js
│   ├── vercel.json           ← Config SPA routing
│   └── package.json
│
└── backend/                  → Déployer sur Railway
    ├── src/
    │   ├── index.js          ← Serveur Express
    │   └── routes/
    │       ├── emails.js     ← Resend email templates
    │       └── stripe.js     ← Stripe checkout + webhook
    ├── railway.toml          ← Config Railway
    └── package.json
```

---

## Commandes locales

```bash
# Frontend
cd frontend
npm install
cp .env.example .env   # remplir les variables
npm run dev            # → http://localhost:5173

# Backend
cd backend
npm install
cp .env.example .env   # remplir les variables
npm run dev            # → http://localhost:4000
```

---

## Tests rapides après déploiement

| Test | URL |
|------|-----|
| Backend health | `https://RAILWAY_URL/health` |
| Frontend | `https://fxair.vercel.app` |
| Formulaire réservation | Remplir + soumettre → vérifier email |
| Inscription | Créer compte → vérifier email de bienvenue |
| Membership | Cliquer Aviator → mode test Stripe |

> 💡 Utilisez `sk_test_` et `pk_test_` Stripe pour tester sans vraie carte.
#   f x a i r - d e p l o y  
 