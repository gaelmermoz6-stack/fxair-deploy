import { useState, useEffect, useRef, useCallback } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useBookings } from './hooks/useBookings'
import { estimatePrice } from './lib/supabase'
import { createCheckoutSession } from './lib/api'

// ─── DESIGN TOKENS ───────────────────────────────────────────
const G = {
  gold: '#c8aa6e', dimGold: '#9a8060', bg: '#0a0a0a',
  text: '#f0ece4', muted: 'rgba(240,236,228,0.52)',
  border: 'rgba(200,170,110,0.2)', red: '#e06060', green: '#5db876',
}

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{background:#0a0a0a;overflow-x:hidden}
  input,select,textarea{outline:none;font-family:inherit}
  input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
  input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.6) sepia(1) hue-rotate(5deg);cursor:pointer}
  input::placeholder,textarea::placeholder{color:rgba(240,236,228,.25);font-family:'Montserrat',sans-serif;font-size:12px}
  ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#0a0a0a}::-webkit-scrollbar-thumb{background:#c8aa6e44;border-radius:2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideL{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:.7}50%{opacity:1}}
  @keyframes shimmer{0%,100%{opacity:.5}50%{opacity:1}}
  .fu{animation:fadeUp .65s ease forwards}
  .fu2{animation:fadeUp .65s .13s ease forwards;opacity:0}
  .fu3{animation:fadeUp .65s .26s ease forwards;opacity:0}
  .fi{animation:fadeIn .4s ease forwards}
  .sl{animation:slideL .35s ease forwards}
  .reveal{opacity:0;transform:translateY(22px);transition:opacity .55s ease,transform .55s ease}
  .reveal.on{opacity:1;transform:translateY(0)}
  .dest-card:hover .di{transform:scale(1.07)}
  .dest-card:hover .do{background:linear-gradient(0deg,rgba(10,10,10,.97) 0%,rgba(10,10,10,.15) 65%) !important}
  .rc:hover{border-color:rgba(200,170,110,.35) !important;transform:translateY(-3px)}
  .rc{transition:all .3s ease}
  .mc:hover{border-color:#c8aa6e !important}
  .mc{transition:border-color .3s ease}
  .nb:hover{color:#f0ece4 !important}
  .gb:hover{background:#c8aa6e !important;color:#0a0a0a !important}
  .inp:focus{border-bottom-color:#c8aa6e !important}
  .bubble{animation:slideL .3s ease forwards}
  .spin{animation:spin .75s linear infinite;border:2px solid rgba(200,170,110,.25);border-top-color:#c8aa6e;border-radius:50%;width:16px;height:16px;display:inline-block}
  .hl{animation:shimmer 1.3s infinite}
  .hb{animation:fadeIn .2s ease forwards}
`

// ─── DATA ────────────────────────────────────────────────────
const AIRCRAFT = {
  Light:             { name:'Phenom 300E',    pax:'6-7',   range:'2,010 nm', speed:'453 ktas', desc:"Le jet léger le plus vendu au monde. Parfait pour les trajets courts à moyens.", img:'https://images.prismic.io/fxair-cyber-studio/ZroYwkaF0TcGI3Xa_MembershipCTAImage.jpg?auto=format&w=900' },
  Midsize:           { name:'Challenger 300', pax:'8-9',   range:'3,100 nm', speed:'459 ktas', desc:"Cabine debout spacieuse avec autonomie côte à côte. Confort et performance.",     img:'https://images.prismic.io/fxair-cyber-studio/ZroYwkaF0TcGI3Xa_MembershipCTAImage.jpg?auto=format&w=900' },
  'Super-midsize':   { name:'Challenger 350', pax:'9-10',  range:'3,200 nm', speed:'466 ktas', desc:"Confort de cabine de premier plan avec capacité transcontinentale.",              img:'https://images.prismic.io/fxair-cyber-studio/ZroYwkaF0TcGI3Xa_MembershipCTAImage.jpg?auto=format&w=900' },
  Large:             { name:'Global 5000',    pax:'13-14', range:'5,200 nm', speed:'488 ktas', desc:"Autonomie intercontinentale avec cabine ultra-spacieuse.",                        img:'https://images.prismic.io/fxair-cyber-studio/ZroYwkaF0TcGI3Xa_MembershipCTAImage.jpg?auto=format&w=900' },
  'Ultra-Long-Range':{ name:'Global Express', pax:'13-16', range:'6,000 nm', speed:'500 ktas', desc:"New York → Tokyo sans escale dans un luxe absolu.",                               img:'https://images.prismic.io/fxair-cyber-studio/ZroYwkaF0TcGI3Xa_MembershipCTAImage.jpg?auto=format&w=900' },
  Helicopter:        { name:'Sikorsky S-76',  pax:'6-8',   range:'411 nm',   speed:'155 ktas', desc:"Idéal pour les transferts en ville et accès aux sites éloignés.",                 img:'https://images.prismic.io/fxair-cyber-studio/ZroYwkaF0TcGI3Xa_MembershipCTAImage.jpg?auto=format&w=900' },
}

const DESTINATIONS = [
  { city:'Los Angeles, CA', tag:'West Coast',    desc:'6 aéroports privés dans la région LA.',           img:'https://images.prismic.io/fxair-cyber-studio/Zt5PXBoQrfVKl1Jc_HERO_LA_GettyImages-1363277938.jpg?auto=format&w=800' },
  { city:'New York, NY',    tag:'East Coast',    desc:'Teterboro, Westchester ou White Plains.',          img:'https://images.prismic.io/fxair-cyber-studio/Zt5SfBoQrfVKl1KK_AdobeStock_111477681.jpg?auto=format&w=800' },
  { city:'Miami, FL',       tag:'Southeast',     desc:'Opa-locka Executive terminal privé.',              img:'https://images.prismic.io/fxair-cyber-studio/Zt5Q4RoQrfVKl1Jz_AdobeStock_296953502.jpg?auto=format&w=800' },
  { city:'Aspen, CO',       tag:'Mountain',      desc:'Accès direct aux pistes, porte-à-porte.',         img:'https://images.prismic.io/fxair-cyber-studio/ZroYwkaF0TcGI3Xa_MembershipCTAImage.jpg?auto=format&w=800' },
  { city:'Las Vegas, NV',   tag:'Entertainment', desc:'Terminal privé de McCarran, sans attente.',       img:'https://images.prismic.io/fxair-cyber-studio/ZroYwkaF0TcGI3Xa_MembershipCTAImage.jpg?auto=format&w=800' },
  { city:'Chicago, IL',     tag:'Midwest',       desc:'FBOs Midway et DuPage. Business ou loisirs.',    img:'https://images.prismic.io/fxair-cyber-studio/ZroYwkaF0TcGI3Xa_MembershipCTAImage.jpg?auto=format&w=800' },
]

const MEMBERSHIPS = [
  { id:'aviator',      name:'Aviator',  price:'À partir de 150 000 $', icon:'✦',  color:G.dimGold, perks:['Jets légers et midsize','Tarifs fixes prévisibles','Assistance 24h/7j','Réservation prioritaire 48h','5% de dépôt sur crédits charter','Relevés de compte mensuels'] },
  { id:'aviator_plus', name:'Aviator+', price:'À partir de 350 000 $', icon:'✦✦', color:G.gold,    perks:['TOUTES les catégories d\'appareils','Disponibilité garantie','Transport terrestre inclus','Réservation prioritaire 24h','Account manager dédié','Restauration & commodités incluses','Réseau mondial','Bilans annuels personnalisés'] },
]

// ─── PRIMITIVES ──────────────────────────────────────────────
const Logo = ({ onClick }) => (
  <div onClick={onClick} style={{ fontSize:22,fontWeight:700,letterSpacing:8,fontFamily:"'Montserrat',sans-serif",color:G.text,cursor:'pointer',userSelect:'none' }}>
    FX<span style={{ color:G.gold }}>AIR</span>
  </div>
)
const Lbl = ({ c, s={} }) => <span style={{ fontSize:9,letterSpacing:4,textTransform:'uppercase',color:G.gold,fontFamily:"'Montserrat',sans-serif",fontWeight:600,display:'block',marginBottom:12,...s }}>{c}</span>
const Title = ({ children, s={} }) => <h2 style={{ fontSize:'clamp(32px,4vw,54px)',fontWeight:300,lineHeight:1.1,fontFamily:"'Cormorant Garamond',serif",color:G.text,...s }}>{children}</h2>
const GoldBtn = ({ children, onClick, s={}, filled=false }) => (
  <button className='gb' onClick={onClick} style={{ background:filled?G.gold:'transparent',border:`1px solid ${G.gold}`,color:filled?'#0a0a0a':G.gold,padding:'13px 30px',fontSize:10,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:600,cursor:'pointer',transition:'all .3s',...s }}>{children}</button>
)
const HR = () => <div style={{ height:1,background:`linear-gradient(90deg,transparent,${G.border},transparent)`,margin:'0 60px' }} />
const Spinner = () => <div className='spin' />

// ─── TOAST ───────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [])
  return (
    <div className='fi' style={{ position:'fixed',bottom:32,right:32,zIndex:9999,background:type==='error'?'#2a1010':'#0f1a0f',border:`1px solid ${type==='error'?G.red:G.green}`,color:type==='error'?G.red:G.green,padding:'16px 24px',fontFamily:"'Montserrat',sans-serif",fontSize:12,letterSpacing:'1.5px',maxWidth:360 }}>
      {msg}
    </div>
  )
}
function useToast() {
  const [toast, setToast] = useState(null)
  const show = (msg, type='success') => setToast({ msg, type })
  const node = toast ? <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} /> : null
  return { show, node }
}

// ─── AUTH MODAL ──────────────────────────────────────────────
function AuthModal({ onClose }) {
  const { login, register } = useAuth()
  const { show, node } = useToast()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ email:'', password:'', name:'' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const submit = async () => {
    if (!f.email || !f.password) { show('Veuillez remplir tous les champs', 'error'); return }
    setLoading(true)
    try {
      if (mode === 'login') await login(f.email, f.password)
      else {
        if (!f.name) { show('Nom requis', 'error'); setLoading(false); return }
        await register(f.email, f.password, f.name)
      }
      show(mode === 'login' ? 'Connexion réussie ✓' : 'Compte créé ✓')
      setTimeout(onClose, 700)
    } catch (e) { show(e.message, 'error') }
    finally { setLoading(false) }
  }

  const inp = (k, label, type='text', ph='') => (
    <div>
      <label style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:G.gold,fontFamily:"'Montserrat',sans-serif",fontWeight:600,display:'block',marginBottom:6 }}>{label}</label>
      <input className='inp' type={type} placeholder={ph} value={f[k]} onChange={e => set(k, e.target.value)} onKeyDown={e => e.key==='Enter' && submit()}
        style={{ background:'transparent',border:'none',borderBottom:`1px solid ${G.border}`,color:G.text,padding:'9px 0',fontSize:15,fontFamily:"'Cormorant Garamond',serif",transition:'border-color .2s',width:'100%' }} />
    </div>
  )

  return (
    <div style={{ position:'fixed',inset:0,zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.88)',backdropFilter:'blur(14px)' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      {node}
      <div className='fi' style={{ background:'#0d0d0d',border:`1px solid ${G.border}`,padding:'48px 44px',width:'100%',maxWidth:420,position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute',top:18,right:20,background:'none',border:'none',color:G.muted,fontSize:18,cursor:'pointer' }}>✕</button>
        <Logo />
        <div style={{ display:'flex',borderBottom:`1px solid ${G.border}`,margin:'28px 0' }}>
          {[['login','Connexion'],['register','Créer un compte']].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} style={{ background:'none',border:'none',borderBottom:mode===m?`2px solid ${G.gold}`:'2px solid transparent',color:mode===m?G.gold:G.muted,padding:'8px 18px',fontSize:10,letterSpacing:'2px',textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:500,cursor:'pointer',marginBottom:-1,transition:'all .2s' }}>{l}</button>
          ))}
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:22 }}>
          {mode==='register' && inp('name','Nom complet','text','Jean Dupont')}
          {inp('email','Email','email','email@exemple.com')}
          {inp('password','Mot de passe','password','••••••••')}
        </div>
        <button onClick={submit} disabled={loading} style={{ width:'100%',marginTop:28,background:loading?'rgba(200,170,110,.5)':G.gold,color:'#0a0a0a',border:'none',padding:16,fontSize:10,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:700,cursor:loading?'default':'pointer' }}>
          {loading ? 'Chargement…' : mode==='login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </div>
    </div>
  )
}

// ─── NAVBAR ──────────────────────────────────────────────────
function Navbar({ page, setPage, scrolled }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const go = p => { setPage(p); setOpen(false) }

  return (
    <>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <nav style={{ position:'fixed',top:0,left:0,right:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 48px',height:72,background:scrolled||open?'rgba(6,6,6,.97)':'transparent',borderBottom:scrolled?`1px solid ${G.border}`:'none',transition:'all .4s ease',backdropFilter:scrolled||open?'blur(16px)':'none' }}>
        <ul style={{ display:'flex',gap:28,listStyle:'none' }}>
          {[['Premium','home'],['Flotte','fleet'],['Charter','charter'],['Memberships','memberships']].map(([l,p]) => (
            <li key={l}><span className='nb' onClick={() => go(p)} style={{ color:G.gold,fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:500,cursor:'pointer',transition:'color .2s' }}>{l}</span></li>
          ))}
        </ul>
        <Logo onClick={() => go('home')} />
        <div style={{ display:'flex',alignItems:'center',gap:16 }}>
          <ul style={{ display:'flex',gap:28,listStyle:'none' }}>
            {[['Destinations','destinations'],['Contact','contact']].map(([l,p]) => (
              <li key={l}><span className='nb' onClick={() => go(p)} style={{ color:G.gold,fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:500,cursor:'pointer',transition:'color .2s' }}>{l}</span></li>
            ))}
          </ul>
          {user
            ? <div style={{ display:'flex',gap:8 }}>
                <button onClick={() => go('dashboard')} style={{ background:'transparent',border:`1px solid ${G.border}`,color:G.muted,padding:'8px 16px',fontSize:10,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",cursor:'pointer' }}>Mon compte</button>
                <button onClick={() => { logout(); go('home') }} style={{ background:'transparent',border:'1px solid rgba(220,80,80,.3)',color:G.red,padding:'8px 14px',fontSize:10,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",cursor:'pointer' }}>Déco</button>
              </div>
            : <button onClick={() => setShowAuth(true)} style={{ background:G.gold,color:'#0a0a0a',border:'none',padding:'10px 22px',fontSize:10,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:700,cursor:'pointer' }}>Connexion</button>
          }
          <button onClick={() => setOpen(!open)} style={{ background:'none',border:'none',cursor:'pointer',padding:4,display:'flex',flexDirection:'column',gap:5 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ display:'block',width:22,height:1.5,background:G.text,transition:'all .3s',
                transform:open&&i===0?'rotate(45deg) translate(4px,4px)':open&&i===2?'rotate(-45deg) translate(4px,-4px)':'none',
                opacity:open&&i===1?0:1 }} />
            ))}
          </button>
        </div>
      </nav>

      {open && (
        <div className='hb' style={{ position:'fixed',inset:0,zIndex:190,background:'rgba(5,5,5,.97)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:44,backdropFilter:'blur(20px)' }}>
          {[['Accueil','home'],['Flotte','fleet'],['Charter','charter'],['Destinations','destinations'],['Memberships','memberships'],['Contact','contact'],['Mon compte','dashboard']].map((l,i) => (
            <div key={l[0]} onClick={() => go(l[1])} style={{ fontSize:'clamp(30px,5vw,52px)',fontWeight:300,fontFamily:"'Cormorant Garamond',serif",color:G.text,cursor:'pointer',animation:`fadeUp .4s ${i*.07}s ease forwards`,opacity:0,transition:'color .2s' }}
              onMouseEnter={e => e.currentTarget.style.color=G.gold}
              onMouseLeave={e => e.currentTarget.style.color=G.text}>{l[0]}</div>
          ))}
          <div style={{ position:'absolute',bottom:36,fontSize:10,letterSpacing:3,color:G.muted,fontFamily:"'Montserrat',sans-serif",textTransform:'uppercase' }}>1-866-726-1222</div>
        </div>
      )}
    </>
  )
}

// ─── BOOKING FORM ─────────────────────────────────────────────
function BookingForm() {
  const { user } = useAuth()
  const { createFlight } = useBookings()
  const { show, node } = useToast()
  const [tripType, setTripType] = useState('one-way')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState({ from:'',to:'',departure:'',returnDate:'',passengers:1,aircraft_class:'Midsize',contact_email:'',contact_phone:'' })
  const [errors, setErrors] = useState({})
  const set = (k,v) => { setF(p=>({...p,[k]:v})); setErrors(p=>({...p,[k]:''})) }

  const validate = () => {
    const e={}
    if (!f.from) e.from='Requis'
    if (!f.to) e.to='Requis'
    if (!f.departure) e.departure='Requis'
    if (!f.contact_email) e.contact_email='Requis'
    if (tripType==='round-trip'&&!f.returnDate) e.returnDate='Requis'
    return e
  }

  const handleRequest = () => {
    const e=validate(); if(Object.keys(e).length){setErrors(e);return}; setStep(2)
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await createFlight({ ...f, trip_type:tripType, contact_name:user?.user_metadata?.full_name||'Invité' })
      show('✓ Réservation confirmée — email envoyé')
      setStep(3)
    } catch(e) { show(e.message,'error') }
    finally { setLoading(false) }
  }

  const field = (k, label, type='text', ph='') => (
    <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
      <label style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:errors[k]?G.red:G.gold,fontFamily:"'Montserrat',sans-serif",fontWeight:600 }}>
        {label}{errors[k]?` — ${errors[k]}`:''}
      </label>
      <input className='inp' type={type} placeholder={ph} value={f[k]} onChange={e=>set(k,e.target.value)}
        style={{ background:'transparent',border:'none',borderBottom:`1px solid ${errors[k]?G.red:G.border}`,color:G.text,padding:'8px 0',fontSize:14,fontFamily:"'Cormorant Garamond',serif",transition:'border-color .2s',width:'100%',colorScheme:'dark' }} />
    </div>
  )

  if (step===3) return (
    <div className='fi' style={{ textAlign:'center',padding:'20px 0' }}>
      {node}
      <div style={{ fontSize:40,color:G.gold,marginBottom:12 }}>✦</div>
      <p style={{ fontSize:13,letterSpacing:4,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:10 }}>Demande confirmée</p>
      <p style={{ fontSize:20,fontWeight:300,fontFamily:"'Cormorant Garamond',serif" }}>Merci de choisir FXAIR</p>
      <p style={{ fontSize:12,color:G.muted,fontFamily:"'Montserrat',sans-serif",marginTop:8,marginBottom:20 }}>Notre équipe vous contactera dans les 2 heures.</p>
      <button onClick={()=>{setStep(1);setF({from:'',to:'',departure:'',returnDate:'',passengers:1,aircraft_class:'Midsize',contact_email:'',contact_phone:''})}} style={{ background:'none',border:'none',color:G.gold,fontSize:10,letterSpacing:'2px',textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",cursor:'pointer' }}>Nouvelle réservation →</button>
    </div>
  )

  if (step===2) return (
    <div className='fi'>
      {node}
      <p style={{ fontSize:10,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:18 }}>Résumé de votre demande</p>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:24 }}>
        {[['Route',`${f.from} → ${f.to}`],['Type',tripType],['Départ',f.departure],['Passagers',f.passengers],['Appareil',f.aircraft_class],['Prix estimé',`$${estimatePrice(f.aircraft_class,tripType).toLocaleString()}`]].map(([k,v])=>(
          <div key={k} style={{ borderLeft:`2px solid ${G.gold}`,paddingLeft:14 }}>
            <div style={{ fontSize:9,letterSpacing:'2px',textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.muted,marginBottom:4 }}>{k}</div>
            <div style={{ fontSize:18,fontWeight:300,fontFamily:"'Cormorant Garamond',serif" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex',gap:10 }}>
        <button onClick={()=>setStep(1)} style={{ flex:1,background:'transparent',border:`1px solid ${G.border}`,color:G.muted,padding:12,fontSize:10,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",cursor:'pointer' }}>Modifier</button>
        <button onClick={handleConfirm} disabled={loading} style={{ flex:2,background:loading?'rgba(200,170,110,.5)':G.gold,color:'#0a0a0a',border:'none',padding:12,fontSize:10,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:700,cursor:loading?'default':'pointer' }}>
          {loading?<Spinner />:'Confirmer la demande'}
        </button>
      </div>
    </div>
  )

  return (
    <div>
      {node}
      <div style={{ display:'flex',borderBottom:`1px solid ${G.border}`,marginBottom:22 }}>
        {['one-way','round-trip','multi-city'].map(t=>(
          <button key={t} onClick={()=>setTripType(t)} style={{ background:'none',border:'none',borderBottom:tripType===t?`2px solid ${G.gold}`:'2px solid transparent',color:tripType===t?G.gold:G.muted,padding:'7px 16px',fontSize:10,letterSpacing:'2px',textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:500,cursor:'pointer',marginBottom:-1,transition:'all .2s' }}>
            {t==='one-way'?'Aller simple':t==='round-trip'?'Aller-retour':'Multi-destinations'}
          </button>
        ))}
      </div>
      <div style={{ display:'grid',gridTemplateColumns:tripType==='round-trip'?'1fr 1fr 1fr 1fr 70px':'1fr 1fr 1fr 70px',gap:14,marginBottom:18 }}>
        {field('from','De','text','Ville ou aéroport')}
        {field('to','À','text','Ville ou aéroport')}
        {field('departure','Départ','date')}
        {tripType==='round-trip'&&field('returnDate','Retour','date')}
        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          <label style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:G.gold,fontFamily:"'Montserrat',sans-serif",fontWeight:600 }}>PAX</label>
          <input className='inp' type='number' min={1} max={20} value={f.passengers} onChange={e=>set('passengers',e.target.value)} style={{ background:'transparent',border:'none',borderBottom:`1px solid ${G.border}`,color:G.text,padding:'8px 0',fontSize:14,fontFamily:"'Cormorant Garamond',serif",width:'100%',transition:'border-color .2s' }} />
        </div>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'1.5fr 1.5fr 1fr auto',gap:14,alignItems:'end' }}>
        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          <label style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:G.gold,fontFamily:"'Montserrat',sans-serif",fontWeight:600 }}>Appareil</label>
          <select value={f.aircraft_class} onChange={e=>set('aircraft_class',e.target.value)} style={{ background:'#0d0d0d',border:'none',borderBottom:`1px solid ${G.border}`,color:G.text,padding:'8px 0',fontSize:14,fontFamily:"'Cormorant Garamond',serif",cursor:'pointer' }}>
            {Object.keys(AIRCRAFT).map(k=><option key={k} value={k}>{k} — {AIRCRAFT[k].name}</option>)}
          </select>
        </div>
        {field('contact_email','Email *','email','votre@email.com')}
        {field('contact_phone','Téléphone','tel','+1 000 000 0000')}
        <button onClick={handleRequest} style={{ background:G.gold,color:'#0a0a0a',border:'none',padding:'12px 22px',fontSize:10,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',alignSelf:'end' }}>
          Demander un vol
        </button>
      </div>
    </div>
  )
}

// ─── AI CONCIERGE ─────────────────────────────────────────────
function AIConcierge({ inline=false }) {
  const [messages, setMessages] = useState([{ role:'assistant', text:"Bienvenue à bord. Je suis votre concierge FXAIR. Parlez-moi de vos projets de voyage — destination, dates, groupe — et je vous recommanderai l'appareil et l'expérience parfaits." }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  useEffect(()=>{ bottomRef.current?.scrollIntoView({ behavior:'smooth' }) },[messages])

  const send = async () => {
    if (!input.trim()||loading) return
    const txt=input.trim(); setInput('')
    setMessages(p=>[...p,{ role:'user',text:txt }])
    setLoading(true)
    try {
      const history=messages.map(m=>({ role:m.role,content:m.text }))
      const res=await fetch('https://api.anthropic.com/v1/messages',{ method:'POST',headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ model:'claude-sonnet-4-20250514',max_tokens:1000,
          system:`Vous êtes un concierge d'aviation privée élite pour FXAIR. Répondez en français, sophistiqué et concis (max 100 mots). Appareils : Phenom 300E (Léger,6-7pax,2010nm), Challenger 300 (Midsize,8-9pax,3100nm), Challenger 350 (Super-midsize,9-10pax,3200nm), Global 5000 (Large,13-14pax,5200nm), Global Express (Ultra-Long-Range,13-16pax,6000nm), Sikorsky S-76 (Hélicoptère,6-8pax,411nm). Prose élégante. Terminez par "— Concierge FXAIR".`,
          messages:[...history,{ role:'user',content:txt }] }) })
      const data=await res.json()
      const reply=data.content?.find(b=>b.type==='text')?.text||'Veuillez appeler le 1-866-726-1222.'
      setMessages(p=>[...p,{ role:'assistant',text:reply }])
    } catch { setMessages(p=>[...p,{ role:'assistant',text:'Erreur de connexion. Appelez le 1-866-726-1222.' }]) }
    setLoading(false)
  }

  return (
    <div style={{ display:'flex',flexDirection:'column',height:inline?460:'100%',background:inline?'rgba(255,255,255,.02)':'transparent',border:inline?`1px solid ${G.border}`:'none' }}>
      {inline&&<div style={{ padding:'18px 22px',borderBottom:`1px solid ${G.border}`,display:'flex',alignItems:'center',gap:10 }}><div style={{ width:7,height:7,borderRadius:'50%',background:G.gold,animation:'pulse 2s infinite' }}/><span style={{ fontSize:10,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold }}>AI Concierge — En ligne</span></div>}
      <div style={{ flex:1,overflowY:'auto',padding:22,display:'flex',flexDirection:'column',gap:14 }}>
        {messages.map((m,i)=>(
          <div key={i} className='bubble' style={{ display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{ maxWidth:'80%',padding:'13px 17px',background:m.role==='user'?G.gold:'rgba(255,255,255,.04)',color:m.role==='user'?'#0a0a0a':G.text,fontSize:m.role==='user'?13:15,lineHeight:1.7,fontFamily:m.role==='user'?"'Montserrat',sans-serif":"'Cormorant Garamond',serif",fontWeight:m.role==='user'?500:300,border:m.role==='assistant'?`1px solid ${G.border}`:'none' }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading&&<div style={{ display:'flex',alignItems:'center',gap:10 }}><Spinner/><span className='hl' style={{ fontSize:10,letterSpacing:2,color:G.muted,fontFamily:"'Montserrat',sans-serif",textTransform:'uppercase' }}>Consultation…</span></div>}
        <div ref={bottomRef}/>
      </div>
      <div style={{ padding:'14px 22px',borderTop:`1px solid ${G.border}`,display:'flex',gap:10 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Demandez-moi n'importe quoi sur vos vols..."
          style={{ flex:1,background:'transparent',border:'none',borderBottom:`1px solid ${G.border}`,color:G.text,padding:'8px 0',fontSize:14,fontFamily:"'Cormorant Garamond',serif" }}/>
        <button onClick={send} disabled={loading} style={{ background:loading?G.border:G.gold,color:'#0a0a0a',border:'none',padding:'10px 18px',fontSize:10,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:700,cursor:loading?'default':'pointer' }}>
          {loading?'…':'Envoyer'}
        </button>
      </div>
    </div>
  )
}

// ─── FOOTER ──────────────────────────────────────────────────
function Footer({ setPage }) {
  return (
    <footer style={{ background:'#050505',borderTop:`1px solid ${G.border}`,padding:'56px 80px 36px' }}>
      <div style={{ display:'grid',gridTemplateColumns:'1.3fr 1fr 1fr 1fr',gap:48,marginBottom:48 }}>
        <div>
          <div style={{ fontSize:26,fontWeight:700,letterSpacing:8,fontFamily:"'Montserrat',sans-serif",color:G.text,marginBottom:18 }}>FX<span style={{ color:G.gold }}>AIR</span></div>
          <p style={{ fontSize:14,lineHeight:1.9,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300 }}>605 Third Avenue<br/>36th Floor<br/>New York, NY 10158</p>
          <a href='tel:18667261222' style={{ display:'block',marginTop:12,color:G.gold,fontSize:14,textDecoration:'none',fontFamily:"'Montserrat',sans-serif" }}>1-866-726-1222</a>
        </div>
        {[{ t:'Navigation',l:[['Accueil','home'],['Destinations','destinations'],['Memberships','memberships'],['AI Concierge','ai'],['Contact','contact']] },
          { t:'Services',  l:[['Charter On-Demand','home'],['Flotte FXSelect','home'],['Programme Aviator','memberships'],['Programme Aviator+','memberships']] },
          { t:'Entreprise',l:[['Actualités','home'],['Carrières','home'],['Confidentialité','home'],['Conditions','home']] }].map(col=>(
          <div key={col.t}>
            <p style={{ fontSize:9,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:18,fontWeight:600 }}>{col.t}</p>
            {col.l.map(([l,p])=>(
              <p key={l} onClick={()=>setPage(p)} style={{ fontSize:13,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,marginBottom:11,cursor:'pointer',transition:'color .2s' }}
                onMouseEnter={e=>e.currentTarget.style.color=G.text} onMouseLeave={e=>e.currentTarget.style.color=G.muted}>{l}</p>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop:'1px solid rgba(200,170,110,.1)',paddingTop:22,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
        <p style={{ fontSize:10,letterSpacing:1,fontFamily:"'Montserrat',sans-serif",color:'rgba(240,236,228,.25)' }}>© 2026 FXAIR · A Flexjet Company</p>
        <div style={{ display:'flex',gap:10 }}>
          {['Google Play','App Store'].map(a=><span key={a} style={{ border:'1px solid rgba(200,170,110,.3)',padding:'5px 13px',fontSize:9,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,cursor:'pointer' }}>{a}</span>)}
        </div>
      </div>
    </footer>
  )
}

// ─── PAGES ───────────────────────────────────────────────────
function HomePage({ setPage }) {
  const [tab, setTab] = useState('Light')
  const refs = useRef([])
  const addRef = el => { if(el&&!refs.current.includes(el)) refs.current.push(el) }
  useEffect(()=>{ const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('on')}),{threshold:.12}); refs.current.forEach(el=>el&&obs.observe(el)); return ()=>obs.disconnect() },[])
  const ac=AIRCRAFT[tab]
  return (
    <div>
      {/* HERO */}
      <div style={{ position:'relative',height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',overflow:'hidden' }}>
        <video style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',zIndex:0,filter:'brightness(.42)' }} src='https://fxair-cyber-studio.cdn.prismic.io/fxair-cyber-studio/aR3R8WGnmrmGqCLt_FXAir_Website_HomepageHero_Desktop_Final_11182025.mp4' autoPlay muted loop playsInline/>
        <div style={{ position:'absolute',inset:0,background:'linear-gradient(180deg,rgba(10,10,10,.2) 0%,rgba(10,10,10,.5) 55%,rgba(10,10,10,.97) 100%)',zIndex:1 }}/>
        <div className='fu' style={{ position:'relative',zIndex:2,maxWidth:880,padding:'0 24px' }}>
          <span style={{ fontSize:10,letterSpacing:5,textTransform:'uppercase',color:G.gold,fontFamily:"'Montserrat',sans-serif",fontWeight:500,marginBottom:18,display:'block' }}>Le leader incontesté</span>
          <h1 className='fu2' style={{ fontSize:'clamp(46px,7vw,94px)',fontWeight:300,lineHeight:1.02,margin:'0 0 12px',fontFamily:"'Cormorant Garamond',serif",color:G.text }}><em style={{ fontStyle:'italic',color:G.gold }}>L'apogée du</em><br/>charter privé</h1>
          <span className='fu3' style={{ fontSize:11,letterSpacing:5,textTransform:'uppercase',color:'rgba(240,236,228,.6)',fontFamily:"'Montserrat',sans-serif",display:'block',marginBottom:48 }}>Fournisseur premium à la demande</span>
        </div>
        <div className='fu3' style={{ position:'relative',zIndex:2,background:'rgba(7,7,7,.93)',border:`1px solid ${G.border}`,padding:'28px 36px',maxWidth:980,width:'93%',marginTop:14,backdropFilter:'blur(20px)' }}>
          <BookingForm/>
        </div>
      </div>

      {/* ON-DEMAND */}
      <section ref={addRef} className='reveal' style={{ padding:'96px 80px',maxWidth:1380,margin:'0 auto' }}>
        <Lbl c='À la demande'/>
        <Title s={{ marginBottom:18 }}>À la demande <em style={{ fontStyle:'italic',color:G.gold }}>Expertement exécuté</em></Title>
        <p style={{ fontSize:16,lineHeight:1.9,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,maxWidth:620,marginBottom:52 }}>Chez FXAIR, nous livrons une façon élevée de voler en privé, avec une cohérence inégalée et un réseau d'élite de prestataires certifiés.</p>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:36 }}>
          {[{ icon:'⌚',t:'Toujours Cohérent',d:"Chaque vol respecte nos normes strictes, quelle que soit la route." },{ icon:'✈',t:'Accès Premium',d:"Accès exclusif à la flotte FXSelect et aux meilleurs opérateurs mondiaux." },{ icon:'🤝',t:'Service White Glove',d:"De la réservation à l'atterrissage, une précision absolue à chaque étape." }].map(f=>(
            <div key={f.t} style={{ borderLeft:'2px solid rgba(200,170,110,.2)',paddingLeft:26 }}>
              <div style={{ fontSize:30,marginBottom:14 }}>{f.icon}</div>
              <p style={{ fontSize:12,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:8 }}>{f.t}</p>
              <p style={{ fontSize:14,lineHeight:1.8,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300 }}>{f.d}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop:44 }}><GoldBtn>Découvrir la différence FXAIR</GoldBtn></div>
      </section>

      <HR/>

      {/* MEMBERSHIP BANNER */}
      <div style={{ position:'relative',height:500,display:'flex',alignItems:'center',overflow:'hidden' }}>
        <img src='https://images.prismic.io/fxair-cyber-studio/ZroYwkaF0TcGI3Xa_MembershipCTAImage.jpg?auto=format,compress&fit=max&w=1920' alt='' style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',filter:'brightness(.28)' }}/>
        <div ref={addRef} className='reveal' style={{ position:'relative',zIndex:1,padding:'0 80px',maxWidth:580 }}>
          <Lbl c='Memberships'/>
          <Title s={{ marginBottom:18 }}>Private Jet <em style={{ fontStyle:'italic',color:G.gold }}>Memberships</em></Title>
          <p style={{ fontSize:15,lineHeight:1.9,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,marginBottom:30 }}>Rejoignez Aviator ou Aviator+ — accès garanti, tarifs fixes, ciels illimités.</p>
          <GoldBtn onClick={()=>setPage('memberships')}>Explorer les Memberships</GoldBtn>
        </div>
      </div>

      <HR/>

      {/* AIRCRAFT */}
      <section ref={addRef} className='reveal' style={{ padding:'96px 80px',maxWidth:1380,margin:'0 auto' }}>
        <Lbl c='Flotte FXSelect'/>
        <Title s={{ marginBottom:38 }}>Jets Privés Premium <em style={{ fontStyle:'italic',color:G.gold }}>On-Demand</em></Title>
        <div style={{ display:'flex',borderBottom:`1px solid ${G.border}`,marginBottom:44,flexWrap:'wrap' }}>
          {Object.keys(AIRCRAFT).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{ background:'none',border:'none',borderBottom:tab===t?`2px solid ${G.gold}`:'2px solid transparent',color:tab===t?G.gold:G.muted,padding:'11px 20px',fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:500,cursor:'pointer',marginBottom:-1,transition:'all .2s' }}>{t}</button>
          ))}
        </div>
        <div className='fi' key={tab} style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:60,alignItems:'center' }}>
          <img src={ac.img} alt={ac.name} style={{ width:'100%',height:340,objectFit:'cover',filter:'brightness(.8)' }}/>
          <div>
            <h3 style={{ fontSize:44,fontWeight:300,marginBottom:6,fontFamily:"'Cormorant Garamond',serif" }}>{ac.name}</h3>
            <p style={{ fontSize:10,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:18 }}>{tab} Class</p>
            <p style={{ fontSize:15,lineHeight:1.8,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,marginBottom:30 }}>{ac.desc}</p>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:22,marginBottom:38 }}>
              {[['Passagers',ac.pax],['Autonomie',ac.range],['Vitesse',ac.speed],['Classe',tab]].map(([l,v])=>(
                <div key={l} style={{ borderLeft:`2px solid ${G.gold}`,paddingLeft:14 }}>
                  <div style={{ fontSize:24,fontWeight:300,color:G.gold,fontFamily:"'Cormorant Garamond',serif" }}>{v}</div>
                  <div style={{ fontSize:9,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.muted }}>{l}</div>
                </div>
              ))}
            </div>
            <GoldBtn>En savoir plus</GoldBtn>
          </div>
        </div>
      </section>

      <HR/>

      {/* DESTINATIONS */}
      <section ref={addRef} className='reveal' style={{ padding:'96px 80px',maxWidth:1380,margin:'0 auto' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:44 }}>
          <div><Lbl c='Destinations'/><Title>Laissez FXAIR <em style={{ fontStyle:'italic',color:G.gold }}>Vous Emmener</em></Title></div>
          <GoldBtn onClick={()=>setPage('destinations')}>Voir tout</GoldBtn>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20 }}>
          {DESTINATIONS.slice(0,3).map(d=>(
            <div key={d.city} className='dest-card' style={{ position:'relative',height:420,overflow:'hidden',cursor:'pointer' }} onClick={()=>setPage('destinations')}>
              <img className='di' src={d.img} alt={d.city} style={{ width:'100%',height:'100%',objectFit:'cover',transition:'transform .6s ease',filter:'brightness(.58)' }}/>
              <div className='do' style={{ position:'absolute',inset:0,background:'linear-gradient(0deg,rgba(10,10,10,.9) 0%,transparent 58%)',display:'flex',flexDirection:'column',justifyContent:'flex-end',padding:26,transition:'background .4s' }}>
                <span style={{ fontSize:9,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:6 }}>{d.tag}</span>
                <h3 style={{ fontSize:24,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",marginBottom:8 }}>{d.city}</h3>
                <p style={{ fontSize:12,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300 }}>{d.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <HR/>

      {/* AI */}
      <section ref={addRef} className='reveal' style={{ padding:'80px 80px',maxWidth:1380,margin:'0 auto' }}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:60,alignItems:'start' }}>
          <div>
            <Lbl c='Propulsé par IA'/>
            <Title s={{ marginBottom:18 }}>Votre Concierge <em style={{ fontStyle:'italic',color:G.gold }}>Personnel</em></Title>
            <p style={{ fontSize:15,lineHeight:1.9,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,marginBottom:30 }}>Notre concierge IA connaît chaque route, chaque appareil et chaque commodité. Disponible 24h/7j.</p>
            <GoldBtn onClick={()=>setPage('ai')}>Ouvrir le Concierge</GoldBtn>
          </div>
          <AIConcierge inline/>
        </div>
      </section>

      <HR/>

      {/* RESOURCES */}
      <section ref={addRef} className='reveal' style={{ padding:'96px 80px',maxWidth:1380,margin:'0 auto' }}>
        <Lbl c='Restez informé'/>
        <Title s={{ marginBottom:44 }}>Ressources</Title>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:22 }}>
          {[{ type:'Blog',title:'Flight Frequencies',desc:"Analyses de programmes, comparatifs d'appareils et contenus lifestyle.",img:'https://images.prismic.io/fxair-cyber-studio/Zo7itx5LeNNTxAc-_Clippathgroup-1.png?auto=format&w=600' },{ type:'Carrières',title:'Votre Carrière Vers de Nouveaux Sommets',desc:"Rejoignez un acteur de premier plan du charter de jets privés.",img:'https://images.prismic.io/fxair-cyber-studio/Zo7ith5LeNNTxAc9_Clippathgroup-2.png?auto=format&w=600' },{ type:'Actualités',title:'Nos Ondes',desc:"Communiqués de presse et actualités du monde de l'aviation privée.",img:'https://images.prismic.io/fxair-cyber-studio/Zo7itR5LeNNTxAc8_Clippathgroup.png?auto=format&w=600' }].map(r=>(
            <div key={r.type} className='rc' style={{ background:'rgba(255,255,255,.02)',border:'1px solid rgba(200,170,110,.1)',overflow:'hidden',cursor:'pointer' }}>
              <img src={r.img} alt={r.title} style={{ width:'100%',height:210,objectFit:'cover',filter:'brightness(.8)' }}/>
              <div style={{ padding:26 }}>
                <span style={{ fontSize:9,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,display:'block',marginBottom:8 }}>{r.type}</span>
                <h3 style={{ fontSize:20,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",marginBottom:10 }}>{r.title}</h3>
                <p style={{ fontSize:13,lineHeight:1.7,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,marginBottom:18 }}>{r.desc}</p>
                <span style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,borderBottom:`1px solid ${G.gold}`,paddingBottom:2 }}>Lire la suite</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function DestinationsPage({ setPage }) {
  return (
    <div style={{ paddingTop:100,minHeight:'100vh' }}>
      <div style={{ padding:'56px 80px 40px' }}><Lbl c='Explorer'/><Title>Où FXAIR <em style={{ fontStyle:'italic',color:G.gold }}>Vous Emmènera-t-il ?</em></Title></div>
      <div style={{ padding:'0 80px 96px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:22 }}>
        {DESTINATIONS.map(d=>(
          <div key={d.city} className='dest-card' style={{ position:'relative',height:460,overflow:'hidden',cursor:'pointer' }}>
            <img className='di' src={d.img} alt={d.city} style={{ width:'100%',height:'100%',objectFit:'cover',transition:'transform .6s ease',filter:'brightness(.52)' }}/>
            <div className='do' style={{ position:'absolute',inset:0,background:'linear-gradient(0deg,rgba(10,10,10,.93) 0%,transparent 52%)',display:'flex',flexDirection:'column',justifyContent:'flex-end',padding:30,transition:'background .4s' }}>
              <span style={{ fontSize:9,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:6 }}>{d.tag}</span>
              <h3 style={{ fontSize:26,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",marginBottom:8 }}>{d.city}</h3>
              <p style={{ fontSize:12,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,lineHeight:1.6,marginBottom:18 }}>{d.desc}</p>
              <GoldBtn onClick={()=>setPage('contact')} s={{ width:'fit-content' }}>Réserver un vol</GoldBtn>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MembershipsPage({ setPage }) {
  const { user } = useAuth()
  const { show, node } = useToast()
  const handleJoin = async (plan) => {
    if (!user) { show('Connectez-vous pour souscrire','error'); return }
    try { const { url } = await createCheckoutSession(plan, user.id, user.email); window.location.href = url }
    catch(e) { show(e.message,'error') }
  }
  return (
    <div style={{ paddingTop:100,minHeight:'100vh' }}>
      {node}
      <div style={{ padding:'56px 80px 52px',textAlign:'center',maxWidth:760,margin:'0 auto' }}>
        <Lbl c='Accès Exclusif'/><Title>Memberships <em style={{ fontStyle:'italic',color:G.gold }}>Premium</em></Title>
        <p style={{ fontSize:15,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,marginTop:18,lineHeight:1.9 }}>Deux programmes conçus pour ceux qui exigent le meilleur absolu. Accès garanti, tarifs prévisibles.</p>
      </div>
      <div style={{ position:'relative',height:260,overflow:'hidden',marginBottom:68 }}>
        <img src='https://images.prismic.io/fxair-cyber-studio/ZroYwkaF0TcGI3Xa_MembershipCTAImage.jpg?auto=format&w=1920' alt='' style={{ width:'100%',height:'100%',objectFit:'cover',filter:'brightness(.22)' }}/>
        <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center' }}><p style={{ fontSize:'clamp(18px,2vw,26px)',fontWeight:300,color:G.text,fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',textAlign:'center',maxWidth:680 }}>"Un standard rare dans l'aviation charter."</p></div>
      </div>
      <div style={{ padding:'0 80px 96px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:28,maxWidth:1060,margin:'0 auto' }}>
        {MEMBERSHIPS.map(m=>(
          <div key={m.id} className='mc' style={{ border:`1px solid ${m.id==='aviator_plus'?G.gold:G.border}`,padding:'44px 40px',position:'relative',background:m.id==='aviator_plus'?'rgba(200,170,110,.03)':'transparent' }}>
            {m.id==='aviator_plus'&&<div style={{ position:'absolute',top:-1,left:'50%',transform:'translateX(-50%)',background:G.gold,color:'#0a0a0a',fontSize:9,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:700,padding:'4px 18px' }}>Le plus populaire</div>}
            <div style={{ fontSize:26,color:m.color,marginBottom:8 }}>{m.icon}</div>
            <h3 style={{ fontSize:38,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",marginBottom:4 }}>{m.name}</h3>
            <p style={{ fontSize:13,color:G.gold,fontFamily:"'Montserrat',sans-serif",letterSpacing:2,marginBottom:28 }}>{m.price}</p>
            <div style={{ borderTop:`1px solid ${G.border}`,paddingTop:24,marginBottom:32 }}>
              {m.perks.map(p=>(<div key={p} style={{ display:'flex',alignItems:'baseline',gap:10,marginBottom:12 }}><span style={{ color:G.gold,fontSize:9,flexShrink:0 }}>✦</span><span style={{ fontSize:14,fontFamily:"'Montserrat',sans-serif",fontWeight:300,color:G.muted,lineHeight:1.5 }}>{p}</span></div>))}
            </div>
            <GoldBtn filled={m.id==='aviator_plus'} onClick={()=>handleJoin(m.id)}>Rejoindre {m.name}</GoldBtn>
          </div>
        ))}
      </div>
    </div>
  )
}

function AIPage() {
  return (
    <div style={{ paddingTop:72,height:'100vh',display:'flex',flexDirection:'column' }}>
      <div style={{ padding:'36px 80px 18px',borderBottom:`1px solid ${G.border}` }}>
        <Lbl c='IA Propulsée'/><Title>Votre Concierge <em style={{ fontStyle:'italic',color:G.gold }}>Personnel</em></Title>
        <p style={{ fontSize:13,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,marginTop:8 }}>Disponible 24h/7j pour toutes vos questions.</p>
      </div>
      <div style={{ flex:1,overflow:'hidden',maxWidth:840,width:'100%',alignSelf:'center',display:'flex',flexDirection:'column',padding:'0 24px' }}><AIConcierge/></div>
    </div>
  )
}

function ContactPage() {
  const { show, node } = useToast()
  const { submitContact } = { submitContact: async (p) => { const { submitContact } = await import('./lib/supabase'); return submitContact(p) } }
  const [f, setF] = useState({ name:'',email:'',phone:'',message:'' })
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const set = (k,v) => setF(p=>({...p,[k]:v}))

  const submit = async () => {
    if (!f.name||!f.email||!f.message) { show('Remplissez tous les champs obligatoires','error'); return }
    setLoading(true)
    try { const { submitContact: sc } = await import('./lib/supabase'); await sc(f); setSent(true) }
    catch(e) { show(e.message,'error') }
    finally { setLoading(false) }
  }

  if (sent) return (
    <div style={{ paddingTop:72,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',textAlign:'center',gap:18 }}>
      <div style={{ fontSize:52,color:G.gold }}>✦</div>
      <Title>Message <em style={{ fontStyle:'italic',color:G.gold }}>Reçu</em></Title>
      <p style={{ fontSize:14,color:G.muted,fontFamily:"'Montserrat',sans-serif",maxWidth:380 }}>Notre équipe vous contactera dans les 2 heures.</p>
    </div>
  )

  const field = (k,label,type='text',multi=false) => (
    <div>
      <label style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:G.gold,fontFamily:"'Montserrat',sans-serif",fontWeight:600,display:'block',marginBottom:7 }}>{label}</label>
      {multi
        ? <textarea rows={4} value={f[k]} onChange={e=>set(k,e.target.value)} style={{ background:'transparent',border:`1px solid ${G.border}`,color:G.text,padding:12,fontSize:15,fontFamily:"'Cormorant Garamond',serif",resize:'vertical',width:'100%' }}/>
        : <input className='inp' type={type} value={f[k]} onChange={e=>set(k,e.target.value)} style={{ background:'transparent',border:'none',borderBottom:`1px solid ${G.border}`,color:G.text,padding:'10px 0',fontSize:15,fontFamily:"'Cormorant Garamond',serif",transition:'border-color .2s',width:'100%' }}/>}
    </div>
  )

  return (
    <div style={{ paddingTop:100,minHeight:'100vh' }}>
      {node}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:72,padding:'56px 80px 96px',maxWidth:1260,margin:'0 auto' }}>
        <div>
          <Lbl c='Contactez-nous'/><Title s={{ marginBottom:22 }}>Notre <em style={{ fontStyle:'italic',color:G.gold }}>Équipe</em></Title>
          <p style={{ fontSize:15,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,lineHeight:1.9,marginBottom:44 }}>Nos spécialistes sont disponibles 24h/7j pour vos besoins de charter, memberships et toute autre question.</p>
          {[['📍 Adresse','605 Third Avenue, 36th Floor\nNew York, NY 10158'],['📞 Téléphone','1-866-726-1222'],['✉️ Email','charter@fxair.com'],['🕐 Disponibilité','24h/7j — Toujours disponible']].map(([l,v])=>(
            <div key={l} style={{ marginBottom:24 }}>
              <p style={{ fontSize:9,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:5 }}>{l}</p>
              <p style={{ fontSize:15,fontFamily:"'Cormorant Garamond',serif",color:G.text,lineHeight:1.8,whiteSpace:'pre-line' }}>{v}</p>
            </div>
          ))}
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:22 }}>
          <p style={{ fontSize:10,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold }}>Envoyer un message</p>
          {field('name','Nom complet *')}
          {field('email','Email *','email')}
          {field('phone','Téléphone','tel')}
          {field('message','Comment pouvons-nous vous aider ? *','text',true)}
          <button onClick={submit} disabled={loading} style={{ background:loading?'rgba(200,170,110,.5)':G.gold,color:'#0a0a0a',border:'none',padding:16,fontSize:10,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:700,cursor:loading?'default':'pointer' }}>
              {loading?<Spinner/>:'Envoyer le message'}
            </button>
        </div>
      </div>
    </div>
  )
}

function DashboardPage({ setPage }) {
  const { user, profile, logout } = useAuth()
  const { bookings, bLoading, fetchBookings, cancel } = useBookings()
  const { show, node } = useToast()
  const [tab, setTab] = useState('flights')

  useEffect(()=>{ if(user) fetchBookings() },[user])

  if (!user) return (
    <div style={{ paddingTop:72,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:20 }}>
      <p style={{ fontSize:24,fontWeight:300,fontFamily:"'Cormorant Garamond',serif" }}>Veuillez vous connecter</p>
      <GoldBtn filled onClick={()=>setPage('home')}>Retour à l'accueil</GoldBtn>
    </div>
  )

  const SC = { pending:{bg:'rgba(200,170,110,.13)',c:G.gold},confirmed:{bg:'rgba(80,180,100,.13)',c:G.green},cancelled:{bg:'rgba(220,80,80,.13)',c:G.red},completed:{bg:'rgba(100,150,220,.13)',c:'#6496dc'} }
  const tabBtn = (t,l) => <button onClick={()=>setTab(t)} style={{ background:'none',border:'none',borderBottom:tab===t?`2px solid ${G.gold}`:'2px solid transparent',color:tab===t?G.gold:G.muted,padding:'11px 22px',fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:500,cursor:'pointer',marginBottom:-1,transition:'all .2s' }}>{l}</button>

  return (
    <div style={{ maxWidth:1300,margin:'0 auto',padding:'100px 80px 80px' }}>
      {node}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:44 }}>
        <div><Lbl c={profile?.membership&&profile.membership!=='none'?`Membre ${profile.membership.replace('_','+')}`:'Compte Standard'}/><Title>Bienvenue, <em style={{ fontStyle:'italic',color:G.gold }}>{profile?.full_name?.split(' ')[0]||'Voyageur'}</em></Title></div>
        <div style={{ display:'flex',gap:10 }}>
          <GoldBtn onClick={()=>setPage('home')}>Réserver un vol</GoldBtn>
          <button onClick={()=>{logout();setPage('home')}} style={{ background:'transparent',border:'1px solid rgba(220,80,80,.3)',color:G.red,padding:'11px 20px',fontSize:10,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",cursor:'pointer' }}>Déconnexion</button>
        </div>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:18,marginBottom:44 }}>
        {[['Vols totaux',bookings.length],['Actifs',bookings.filter(b=>b.status==='pending'||b.status==='confirmed').length],['Investi',bookings.filter(b=>b.paid_at).reduce((s,b)=>s+Number(b.estimated_price),0)?`$${(bookings.filter(b=>b.paid_at).reduce((s,b)=>s+Number(b.estimated_price),0)/1000).toFixed(0)}k`:'—'],['Membership',profile?.membership==='none'?'Aucun':profile?.membership==='aviator_plus'?'Aviator+':'Aviator']].map(([l,v]) => (
          <div key={l} style={{ border:`1px solid ${G.border}`,padding:26,background:'rgba(255,255,255,.02)' }}>
            <p style={{ fontSize:9,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:8 }}>{l}</p>
            <p style={{ fontSize:32,fontWeight:300,fontFamily:"'Cormorant Garamond',serif" }}>{v}</p>
          </div>
        ))}
      </div>
      <div style={{ borderBottom:`1px solid ${G.border}`,marginBottom:36,display:'flex' }}>
        {tabBtn('flights','Mes vols')}{tabBtn('membership','Membership')}{tabBtn('profile','Profil')}
      </div>

      {tab==='flights'&&(
        <div>
          {bLoading&&<div style={{ display:'flex',justifyContent:'center',padding:40 }}><Spinner/></div>}
          {!bLoading&&bookings.length===0&&<div style={{ textAlign:'center',padding:'56px 0' }}><p style={{ fontSize:22,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",marginBottom:14 }}>Aucun vol pour l'instant</p><GoldBtn filled onClick={()=>setPage('home')}>Réserver mon premier vol</GoldBtn></div>}
          {bookings.map(b=>{const sc=SC[b.status]||SC.pending; return(
            <div key={b.id} style={{ border:`1px solid ${G.border}`,padding:'22px 26px',marginBottom:12,display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:18,alignItems:'center',background:'rgba(255,255,255,.02)' }}>
              <div><p style={{ fontSize:20,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",marginBottom:4 }}>{b.from_location}→{b.to_location}</p><p style={{ fontSize:10,color:G.muted,fontFamily:"'Montserrat',sans-serif",letterSpacing:1 }}>#{b.id?.slice(0,8)?.toUpperCase()} · {b.trip_type}</p></div>
              <div><p style={{ fontSize:9,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:4 }}>Départ</p><p style={{ fontSize:14,fontFamily:"'Cormorant Garamond',serif" }}>{b.departure_date}</p></div>
              <div><p style={{ fontSize:9,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:4 }}>Appareil</p><p style={{ fontSize:14,fontFamily:"'Cormorant Garamond',serif" }}>{b.aircraft_class}</p></div>
              <div><p style={{ fontSize:9,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:4 }}>Prix estimé</p><p style={{ fontSize:14,fontFamily:"'Cormorant Garamond',serif" }}>${Number(b.estimated_price||0).toLocaleString()}</p></div>
              <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8 }}>
                <span style={{ background:sc.bg,color:sc.c,padding:'4px 12px',fontSize:9,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif" }}>{b.status}</span>
                {(b.status==='pending'||b.status==='confirmed')&&<button onClick={()=>{cancel(b.id);show('Annulé')}} style={{ background:'none',border:'none',color:G.red,fontSize:10,cursor:'pointer',fontFamily:"'Montserrat',sans-serif" }}>Annuler</button>}
              </div>
            </div>
          )})}
        </div>
      )}
      {tab==='membership'&&(
        <div style={{ maxWidth:640 }}>
          {profile?.membership&&profile.membership!=='none'
            ? <div style={{ border:`1px solid ${G.gold}`,padding:40,background:'rgba(200,170,110,.03)' }}><Lbl c='Plan actif'/><h2 style={{ fontSize:40,fontWeight:300,fontFamily:"'Cormorant Garamond',serif",marginBottom:14 }}>{profile.membership==='aviator_plus'?'Aviator+':'Aviator'}</h2><p style={{ fontSize:13,color:G.muted,fontFamily:"'Montserrat',sans-serif" }}>Statut : <span style={{ color:G.green }}>Actif</span></p></div>
            : <div><p style={{ fontSize:16,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,lineHeight:1.8,marginBottom:36 }}>Aucun membership actif. Rejoignez Aviator ou Aviator+ pour bénéficier d'un accès garanti.</p><GoldBtn filled onClick={()=>setPage('memberships')}>Explorer les Memberships</GoldBtn></div>}
        </div>
      )}
      {tab==='profile'&&(
        <div style={{ maxWidth:480,display:'flex',flexDirection:'column',gap:24 }}>
          <div><label style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:G.gold,fontFamily:"'Montserrat',sans-serif",fontWeight:600,display:'block',marginBottom:7 }}>Email</label><p style={{ fontSize:16,fontFamily:"'Cormorant Garamond',serif",color:G.muted,padding:'10px 0',borderBottom:`1px solid ${G.border}` }}>{user.email}</p></div>
          <GoldBtn filled onClick={()=>show('Profil mis à jour ✓')}>Sauvegarder</GoldBtn>
        </div>
      )}
    </div>
  )
}

// ─── CHARTER PAGE ───────────────────────────────────────────────
function CharterPage({ setPage }) {
  const refs = useRef([])
  const addRef = el => { if(el&&!refs.current.includes(el)) refs.current.push(el) }
  useEffect(()=>{ const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('on')}),{threshold:.12}); refs.current.forEach(el=>el&&obs.observe(el)); return ()=>obs.disconnect() },[])
  
  const charterTypes = [
    { icon: '💼', title: 'Voyage Business', desc: 'Déplacez-vous efficacement pour vos réunions importantes. Ponctualité garantie, confidentialité absolue.', features: ['Check-in 15 min', 'WiFi haut débit', 'Espace de travail'] },
    { icon: '🏖️', title: 'Voyage Personnel', desc: 'Échappez-vous en famille ou entre amis vers vos destinations favorites en toute liberté.', features: ['Flexibilité totale', 'Bagages illimités', 'Animaux acceptés'] },
    { icon: '👥', title: 'Voyage Groupe', desc: 'Transportez votre équipe ou vos invités avec confort et style. Jusqu\'à 19 passagers.', features: ['Cabine spacieuse', 'Catering premium', 'Configuration sur mesure'] },
    { icon: '👑', title: 'Voyage VIP', desc: 'L\'excellence absolue pour vos déplacements les plus exigeants. Service white glove.', features: ['Concierge dédié', 'Accès salon privé', 'Sécurité renforcée'] }
  ]
  
  const processSteps = [
    { num: '01', title: 'Demande', desc: 'Formulaire en ligne ou appel. Décrivez votre besoin.' },
    { num: '02', title: 'Devis', desc: 'Proposition personnalisée sous 2 heures. Prix fixe garanti.' },
    { num: '03', title: 'Confirmation', desc: 'Validation en un clic. Paiement sécurisé.' },
    { num: '04', title: 'Vol', desc: 'Embarquement 15 min avant décollage. Service premium à bord.' }
  ]
  
  return (
    <div style={{ paddingTop:100,minHeight:'100vh' }}>
      {/* HERO */}
      <section ref={addRef} className='reveal' style={{ padding:'56px 80px 40px' }}>
        <Lbl c='Location'/>
        <Title s={{ marginBottom:18 }}>Location de Jets <em style={{ fontStyle:'italic',color:G.gold }}>Privés</em></Title>
        <p style={{ fontSize:16,lineHeight:1.9,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,maxWidth:720 }}>
          Découvrez le service FXAIR — une expérience de vol sur-mesure, conçue pour ceux qui exigent l'excellence à chaque instant.
        </p>
      </section>
      
      {/* TYPES DE VOYAGE */}
      <section ref={addRef} className='reveal' style={{ padding:'0 80px 60px' }}>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:24 }}>
          {charterTypes.map((t,i)=> (
            <div key={t.title} style={{ border:`1px solid ${G.border}`,padding:36,background:'rgba(255,255,255,.02)' }}>
              <div style={{ fontSize:32,marginBottom:16 }}>{t.icon}</div>
              <p style={{ fontSize:12,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:12 }}>{t.title}</p>
              <p style={{ fontSize:14,lineHeight:1.8,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,marginBottom:20 }}>{t.desc}</p>
              <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
                {t.features.map(f=> (
                  <span key={f} style={{ fontSize:9,letterSpacing:1,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.muted,border:`1px solid ${G.border}`,padding:'6px 12px' }}>{f}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      
      {/* PROCESSUS */}
      <section ref={addRef} className='reveal' style={{ padding:'60px 80px',background:'linear-gradient(180deg,transparent 0%,rgba(200,170,110,.05) 50%,transparent 100%)' }}>
        <Lbl c='Comment ça marche'/>
        <Title s={{ marginBottom:44 }}>Simple, Rapide, <em style={{ fontStyle:'italic',color:G.gold }}>Premium</em></Title>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:24 }}>
          {processSteps.map((s,i)=> (
            <div key={s.num} style={{ textAlign:'center',padding:26,borderLeft:i>0?`1px solid ${G.border}`:'none' }}>
              <div style={{ fontSize:48,fontWeight:300,color:'rgba(200,170,110,.2)',fontFamily:"'Cormorant Garamond',serif",marginBottom:12 }}>{s.num}</div>
              <p style={{ fontSize:13,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:10 }}>{s.title}</p>
              <p style={{ fontSize:13,lineHeight:1.7,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
      
      {/* CTA */}
      <section ref={addRef} className='reveal' style={{ padding:'80px 80px 100px',textAlign:'center' }}>
        <Lbl c='Réserver'/>
        <Title s={{ marginBottom:24 }}>Prêt à <em style={{ fontStyle:'italic',color:G.gold }}>Voler</em> ?</Title>
        <p style={{ fontSize:15,lineHeight:1.8,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,marginBottom:36 }}>
          Obtenez votre devis personnalisé en moins de 2 heures. Prix fixe garanti, sans surprise.
        </p>
        <GoldBtn onClick={()=>setPage('home')}>Demander un devis</GoldBtn>
      </section>
    </div>
  )
}

// ─── FLEET PAGE ────────────────────────────────────────────────
function FleetPage({ setPage }) {
  const [selected, setSelected] = useState('Light')
  const refs = useRef([])
  const addRef = el => { if(el&&!refs.current.includes(el)) refs.current.push(el) }
  useEffect(()=>{ const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('on')}),{threshold:.12}); refs.current.forEach(el=>el&&obs.observe(el)); return ()=>obs.disconnect() },[])
  
  const fleetCategories = [
    {
      key: 'Light',
      name: 'Light Jets',
      desc: 'Idéals pour les courts et moyens-courriers. Agilité, confort et efficacité.',
      aircraft: [
        { name: 'Citation CJ3+', pax: 6, range: '3,200 km', speed: '700 km/h', img: 'https://images.prismic.io/fxair-cyber-studio/ZroZQUaF0TcGI3cD_CitationCJ3.png?auto=format,compress&fit=max&w=800' },
        { name: 'Phenom 300E', pax: 8, range: '3,700 km', speed: '750 km/h', img: 'https://images.prismic.io/fxair-cyber-studio/ZroZREaF0TcGI3cG_Phenom300E.png?auto=format,compress&fit=max&w=800' }
      ]
    },
    {
      key: 'Mid',
      name: 'Mid Jets',
      desc: 'Le meilleur compromis pour les voyages transcontinentaux. Espace et performance.',
      aircraft: [
        { name: 'Citation Latitude', pax: 8, range: '5,200 km', speed: '800 km/h', img: 'https://images.prismic.io/fxair-cyber-studio/ZroZPkaF0TcGI3cB_CitationLatitude.png?auto=format,compress&fit=max&w=800' },
        { name: 'Gulfstream G150', pax: 7, range: '5,600 km', speed: '850 km/h', img: 'https://images.prismic.io/fxair-cyber-studio/ZroZPkaF0TcGI3cC_GulfstreamG150.png?auto=format,compress&fit=max&w=800' }
      ]
    },
    {
      key: 'Large',
      name: 'Large Jets',
      desc: 'Pour les longs courriers avec confort maximal. Stand-up cabin, catering complet.',
      aircraft: [
        { name: 'Challenger 350', pax: 10, range: '5,900 km', speed: '850 km/h', img: 'https://images.prismic.io/fxair-cyber-studio/ZroZOkaF0TcGI3b__Challenger350.png?auto=format,compress&fit=max&w=800' },
        { name: 'Falcon 2000LXS', pax: 10, range: '7,400 km', speed: '850 km/h', img: 'https://images.prismic.io/fxair-cyber-studio/ZroZOUaF0TcGI3b9_Falcon2000LXS.png?auto=format,compress&fit=max&w=800' }
      ]
    },
    {
      key: 'Ultra',
      name: 'Ultra Long Range',
      desc: 'L\'excellence intercontinentale. Vols directs Paris-Tokyo ou New York-Sydney.',
      aircraft: [
        { name: 'Gulfstream G650ER', pax: 16, range: '13,800 km', speed: '950 km/h', img: 'https://images.prismic.io/fxair-cyber-studio/ZroZPEaF0TcGI3cA_GulfstreamG650.png?auto=format,compress&fit=max&w=800' },
        { name: 'Global 7500', pax: 19, range: '14,200 km', speed: '920 km/h', img: 'https://images.prismic.io/fxair-cyber-studio/ZroZO0aF0TcGI3cD_Global7500.png?auto=format,compress&fit=max&w=800' }
      ]
    }
  ]
  
  const current = fleetCategories.find(c => c.key === selected)
  
  return (
    <div style={{ paddingTop:100,minHeight:'100vh' }}>
      {/* HERO */}
      <section ref={addRef} className='reveal' style={{ padding:'56px 80px 40px' }}>
        <Lbl c='Notre Flotte'/>
        <Title s={{ marginBottom:18 }}>Flotte FXSelect <em style={{ fontStyle:'italic',color:G.gold }}>Premium</em></Title>
        <p style={{ fontSize:16,lineHeight:1.9,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300,maxWidth:720 }}>
          Une flotte rigoureusement sélectionnée des meilleurs jets privés mondiaux. Chaque appareil est audité et maintenu aux standards les plus exigeants.
        </p>
      </section>
      
      {/* CATEGORY TABS */}
      <section style={{ padding:'0 80px 40px' }}>
        <div style={{ display:'flex',borderBottom:`1px solid ${G.border}`,marginBottom:44 }}>
          {fleetCategories.map(c=> (
            <button 
              key={c.key} 
              onClick={()=>setSelected(c.key)}
              style={{ 
                background:'none',border:'none',borderBottom:selected===c.key?`2px solid ${G.gold}`:'2px solid transparent',
                color:selected===c.key?G.gold:G.muted,padding:'14px 28px',fontSize:11,letterSpacing:'2.5px',
                textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",fontWeight:500,cursor:'pointer',
                marginBottom:-1,transition:'all .2s'
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        
        {/* CATEGORY DESCRIPTION */}
        <div ref={addRef} className='reveal' style={{ marginBottom:48 }}>
          <p style={{ fontSize:15,lineHeight:1.8,color:G.muted,fontFamily:"'Montserrat',sans-serif",fontWeight:300 }}>{current.desc}</p>
        </div>
        
        {/* AIRCRAFT GRID */}
        <div ref={addRef} className='reveal' style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:32 }}>
          {current.aircraft.map(a=> (
            <div key={a.name} style={{ border:`1px solid ${G.border}`,background:'rgba(255,255,255,.02)' }}>
              <div style={{ height:240,overflow:'hidden' }}>
                <img src={a.img} alt={a.name} style={{ width:'100%',height:'100%',objectFit:'cover',filter:'brightness(.85)' }}/>
              </div>
              <div style={{ padding:28 }}>
                <h3 style={{ fontSize:28,fontWeight:300,marginBottom:8,fontFamily:"'Cormorant Garamond',serif" }}>{a.name}</h3>
                <p style={{ fontSize:10,letterSpacing:3,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.gold,marginBottom:24 }}>{selected} Class</p>
                
                <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:28 }}>
                  {[['Passagers',a.pax],['Autonomie',a.range],['Vitesse',a.speed]].map(([l,v])=> (
                    <div key={l} style={{ borderLeft:`2px solid ${G.gold}`,paddingLeft:12 }}>
                      <div style={{ fontSize:22,fontWeight:300,color:G.gold,fontFamily:"'Cormorant Garamond',serif" }}>{v}</div>
                      <div style={{ fontSize:9,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.muted }}>{l}</div>
                    </div>
                  ))}
                </div>
                
                <GoldBtn onClick={()=>setPage('home')} s={{ width:'100%' }}>Réserver ce jet</GoldBtn>
              </div>
            </div>
          ))}
        </div>
      </section>
      
      {/* STATS */}
      <section ref={addRef} className='reveal' style={{ padding:'80px 80px 100px' }}>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:24,padding:40,border:`1px solid ${G.border}`,background:'rgba(200,170,110,.03)' }}>
          {[['50+','Appareils Certifiés'],['120+','Destinations','Directes'],['99.8%','Taux de','Ponctualité'],['24/7','Concierge','Global']].map(([n,l1,l2])=> (
            <div key={n} style={{ textAlign:'center',padding:'20px 0' }}>
              <div style={{ fontSize:48,fontWeight:300,color:G.gold,fontFamily:"'Cormorant Garamond',serif",marginBottom:8 }}>{n}</div>
              <p style={{ fontSize:11,letterSpacing:2,textTransform:'uppercase',fontFamily:"'Montserrat',sans-serif",color:G.muted }}>{l1}{l2&&<><br/>{l2}</>}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]     = useState('home')
  const [scrolled, setScrolled] = useState(false)
  useEffect(()=>{ const h=()=>setScrolled(window.scrollY>60); window.addEventListener('scroll',h); return()=>window.removeEventListener('scroll',h) },[])
  useEffect(()=>{ window.scrollTo({ top:0,behavior:'smooth' }) },[page])

  const PAGES = { home:HomePage, destinations:DestinationsPage, memberships:MembershipsPage, ai:AIPage, contact:ContactPage, dashboard:DashboardPage, charter:CharterPage, fleet:FleetPage }
  const Page = PAGES[page]||HomePage

  return (
    <AuthProvider>
      <style>{GLOBAL_CSS}</style>
      <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif",background:G.bg,color:G.text,minHeight:'100vh',overflowX:'hidden' }}>
        <Navbar page={page} setPage={setPage} scrolled={scrolled}/>
        <main><Page setPage={setPage}/></main>
        {page!=='ai'&&<Footer setPage={setPage}/>}
      </div>
    </AuthProvider>
  )
}
