import Link from "next/link";
import { ArrowRight, BadgeCheck, Bolt, CreditCard, Globe2, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import LandingNav from "@/components/layout/LandingNav";

const services = [
  ["Virtual Numbers", "Reliable numbers for supported services", Globe2],
  ["Data & Airtime", "Fast, convenient top-ups and bundles", Bolt],
  ["Digital Products", "Popular digital products in one place", CreditCard],
  ["Secure Wallet", "Fund, pay and track your orders", WalletCards],
];

export default function HomePage() {
  return (
    <main className="landing">
      <div className="landing-grid" />
      <LandingNav />

      <section className="hero">
        <div className="eyebrow"><Sparkles size={14}/> TRUSTED DIGITAL SERVICES, ALL IN ONE PLACE</div>
        <h1>Digital Services.<br/><span>Made Simple.</span></h1>
        <p>Access convenient digital products, data plans, subscriptions, gift cards and more through one secure, easy-to-use platform.</p>
        <div className="hero-actions">
          <Link className="primary-btn" href="/register">Get Started <ArrowRight size={18}/></Link>
          <Link className="secondary-btn" href="/services">View Services</Link>
        </div>
        <div className="hero-proof"><BadgeCheck size={18}/><span>Secure payments</span><i/> <span>Fast order processing</span><i/> <span>Simple account management</span></div>
      </section>

      <section className="stats" aria-label="CharpsDev highlights">
        <div><strong>180<span>+</span></strong><small>Service options</small></div>
        <div><strong>24/7</strong><small>Platform access</small></div>
        <div><strong>100<span>%</span></strong><small>Secure checkout</small></div>
        <div><strong>1</strong><small>Simple dashboard</small></div>
      </section>

      <section id="services" className="section">
        <div className="section-heading"><span>EXPLORE CHARPSDEV</span><h2>Everything you need,<br/><em>in one dashboard.</em></h2><p>Browse services, fund your wallet, place orders and keep track of every transaction without switching platforms.</p></div>
        <div className="service-grid">
          {services.map(([title, text, Icon]) => <article className="service-card" key={title as string}><div className="icon-wrap"><Icon size={24}/></div><h3>{title as string}</h3><p>{text as string}</p><Link href="/services">Explore <ArrowRight size={16}/></Link></article>)}
        </div>
      </section>

      <section id="how-it-works" className="section steps-section">
        <div className="section-heading centered"><span>HOW IT WORKS</span><h2>From signup to service<br/><em>in a few simple steps.</em></h2></div>
        <div className="steps">
          {["Create your account","Fund your wallet","Choose a service","Track your order"].map((step, i)=><div className="step" key={step}><b>0{i+1}</b><h3>{step}</h3><p>{["Register in minutes and access your personal dashboard.","Add funds securely using the available payment options.","Browse categories and select the service that fits your needs.","View order status and transaction history from one place."][i]}</p></div>)}
        </div>
      </section>

      <section id="why-us" className="security">
        <div><span>BUILT FOR CONVENIENCE</span><h2>A smoother way to manage<br/><em>digital services.</em></h2><p>CharpsDev brings discovery, payments, orders and account management together in a clean, secure experience.</p><Link className="primary-btn" href="/register">Create Free Account <ArrowRight size={18}/></Link></div>
        <div className="security-card"><ShieldCheck size={42}/><h3>Designed with security in mind</h3><p>Clear wallet activity, organized orders and protected account access help you stay in control.</p><div className="security-row"><span>Secure access</span><b>Active</b></div><div className="security-row"><span>Order tracking</span><b>Included</b></div></div>
      </section>

      <section className="final-cta"><Sparkles size={22}/><h2>Ready to simplify your<br/><span>digital experience?</span></h2><p>Create your CharpsDev account and explore available services today.</p><Link className="primary-btn" href="/register">Get Started Now <ArrowRight size={18}/></Link></section>

      <footer><Link href="/" className="brand"><img src="/logo.png" alt="CharpsDev" className="brand-logo" /></Link><p>Digital services, made simple.</p><div><Link href="/login">Log in</Link><Link href="/register">Create account</Link><Link href="/services">Services</Link></div><small>© {new Date().getFullYear()} CharpsDev. All rights reserved.</small></footer>
    </main>
  );
}
