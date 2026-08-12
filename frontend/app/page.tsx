import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bolt,
  CreditCard,
  Globe2,
  Headphones,
  Layers,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import LandingNav from "@/components/layout/LandingNav";
import StructuredData from "@/components/seo/StructuredData";

const services = [
  ["Virtual Numbers", "Reliable numbers for supported services", Globe2],
  ["Data & Airtime", "Fast, convenient top-ups and bundles", Bolt],
  ["Digital Products", "Popular digital products in one place", CreditCard],
  ["Secure Wallet", "Fund, pay and track your orders", WalletCards],
];

const features = [
  {
    title: "Verified, reliable delivery",
    text: "Every data plan, airtime top-up, gift card and virtual number on CharpsDev runs through checked provider connections, so what you order is what lands in your account.",
    icon: BadgeCheck,
  },
  {
    title: "Secure wallet transactions",
    text: "Purchases are paid from your CharpsDev wallet instead of exposing card details to individual services, and any order that can't be fulfilled is refunded straight back to your balance.",
    icon: ShieldCheck,
  },
  {
    title: "A wide range of services",
    text: "Data bundles, airtime, gift cards, eSIMs and virtual numbers — browse a growing catalogue of digital services without opening a separate account for each one.",
    icon: Layers,
  },
  {
    title: "Support when you need it",
    text: "Questions about an order, a wallet transaction or your account are handled by a real support channel, not a dead end — so you're never left guessing.",
    icon: Headphones,
  },
];

const journeySteps = [
  {
    title: "Explore services",
    text: "Browse data plans, airtime, gift cards, eSIMs and virtual numbers, and use categories to find exactly what you need.",
  },
  {
    title: "Fund your wallet",
    text: "Add funds securely using the available payment options — pay once, then check out instantly for every future order.",
  },
  {
    title: "Checkout securely",
    text: "Confirm your order and pay directly from your wallet balance. No card details re-entered, no third-party checkout pages.",
  },
  {
    title: "Track & enjoy",
    text: "Watch your order move through your dashboard in real time, with a full transaction history you can revisit any time.",
  },
];

const faqs = [
  {
    q: "What is CharpsDev?",
    a: "CharpsDev is a digital services marketplace where you can buy data bundles, airtime, gift cards, eSIMs and virtual numbers online. Everything runs through one secure wallet, so you fund your balance once and pay for any service instantly instead of re-entering card details every time.",
  },
  {
    q: "How do I pay for a service on CharpsDev?",
    a: "Fund your CharpsDev wallet using one of the supported payment options, then choose a service and pay directly from your wallet balance at checkout. Orders are processed automatically once payment is confirmed.",
  },
  {
    q: "Is CharpsDev safe to use?",
    a: "Yes. Every checkout is wallet-based rather than exposing card details to third-party sellers, your account is protected with authenticated access, and every order and transaction is logged in your dashboard so you can review your full history at any time.",
  },
  {
    q: "What happens if an order fails?",
    a: "If a service provider cannot fulfil an order — for example due to temporary stock or connectivity issues — the amount is automatically credited back to your wallet so you never lose funds on a failed order.",
  },
  {
    q: "Can I use CharpsDev on my phone?",
    a: "Yes. CharpsDev works as a responsive web app across phones, tablets and desktop browsers, and can be installed to your home screen for quicker access.",
  },
];

export default function HomePage() {
  return (
    <main className="landing">
      <StructuredData faqs={faqs} />
      <div className="landing-grid" />
      <LandingNav />

      <section className="hero">
        <div className="eyebrow"><Sparkles size={14}/> TRUSTED DIGITAL SERVICES, ALL IN ONE PLACE</div>
        <h1>Digital Services.<br/><span>Made Simple.</span></h1>
        <p>CharpsDev lets you buy data plans, airtime, gift cards, eSIMs and virtual numbers online — all from one secure wallet, without switching between apps or re-entering payment details for every purchase.</p>
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
          {journeySteps.map((step, i) => (
            <div className="step" key={step.title}>
              <b>0{i + 1}</b>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="section">
        <div className="section-heading centered">
          <span>WHAT SETS US APART</span>
          <h2>Built to be the easiest way<br/><em>to buy digital services.</em></h2>
          <p>We validate every provider connection, keep checkout entirely inside your wallet, and give you a real support channel instead of a dead end.</p>
        </div>
        <div className="feature-grid">
          {features.map(({ title, text, icon: Icon }) => (
            <article className="feature-card" key={title}>
              <div className="icon-wrap"><Icon size={22} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="why-us" className="security">
        <div><span>BUILT FOR CONVENIENCE</span><h2>A smoother way to manage<br/><em>digital services.</em></h2><p>CharpsDev brings discovery, payments, orders and account management together in a clean, secure experience.</p><Link className="primary-btn" href="/register">Create Free Account <ArrowRight size={18}/></Link></div>
        <div className="security-card"><ShieldCheck size={42}/><h3>Designed with security in mind</h3><p>Clear wallet activity, organized orders and protected account access help you stay in control.</p><div className="security-row"><span>Secure access</span><b>Active</b></div><div className="security-row"><span>Order tracking</span><b>Included</b></div></div>
      </section>

      <section id="about" className="section">
        <div className="section-heading">
          <span>ABOUT CHARPSDEV</span>
          <h2>Why people choose<br/><em>CharpsDev.</em></h2>
        </div>
        <p>
          CharpsDev was built to solve a simple problem: buying everyday digital services online usually
          means juggling several different apps, re-entering payment details each time, and losing track
          of what you have actually paid for. CharpsDev brings data bundles, airtime top-ups, gift cards,
          eSIMs and virtual numbers into one platform, backed by a single wallet you fund once and spend
          from repeatedly.
        </p>
        <p>
          Every order runs through the same secure checkout flow, and every transaction — successful,
          pending or failed — is recorded in your dashboard so you always have a clear history of your
          spending. If a service provider is ever unable to fulfil an order, the amount is automatically
          returned to your wallet, so funds are never left unaccounted for.
        </p>
        <p>
          CharpsDev is designed as a mobile-first web app, so the full experience — browsing services,
          funding your wallet, placing orders and tracking deliveries — works the same way on a phone,
          tablet or desktop browser, and can be installed to your home screen for quicker access.
        </p>
      </section>

      <section id="faq" className="section steps-section">
        <div className="section-heading centered">
          <span>FREQUENTLY ASKED QUESTIONS</span>
          <h2>Common questions about<br/><em>using CharpsDev.</em></h2>
        </div>
        <div className="faq-list">
          {faqs.map((item) => (
            <article className="faq-item" key={item.q}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta"><Sparkles size={22}/><h2>Ready to simplify your<br/><span>digital experience?</span></h2><p>Create your CharpsDev account and explore available services today.</p><Link className="primary-btn" href="/register">Get Started Now <ArrowRight size={18}/></Link></section>

      <footer>
        <Link href="/" className="brand">
          <Image src="/logo.png" alt="CharpsDev logo" className="brand-logo" width={140} height={29} priority={false} />
        </Link>
        <p>Digital services, made simple.</p>
        <div><Link href="/login">Log in</Link><Link href="/register">Create account</Link><Link href="/services">Services</Link></div>
        <p className="footer-note">
          CharpsDev processes all orders and wallet transactions for legitimate personal and business use only,
          in line with each service provider&apos;s terms. Thank you for using the platform responsibly.
        </p>
        <small>© {new Date().getFullYear()} CharpsDev. All rights reserved.</small>
      </footer>
    </main>
  );
}
