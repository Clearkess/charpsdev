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
  Users,
  WalletCards,
} from "lucide-react";
import LandingNav from "@/components/layout/LandingNav";
import StructuredData from "@/components/seo/StructuredData";

const services = [
  ["Social Media Accounts", "Unique, ready-to-use accounts across platforms", Users],
  ["Virtual Numbers", "Reliable numbers for supported services", Globe2],
  ["eSIMs & Data", "Fast, convenient eSIMs, data and airtime top-ups", Bolt],
  ["Gift Cards & More", "Popular digital products in one place", CreditCard],
];

const features = [
  {
    title: "Verified, reliable delivery",
    text: "Every social media account, virtual number, eSIM and digital product on Vaultra runs through checked provider connections, so what you order is what lands in your account.",
    icon: BadgeCheck,
  },
  {
    title: "Secure wallet transactions",
    text: "Purchases are paid from your Vaultra wallet instead of exposing card details to individual services, and any order that can't be fulfilled is refunded straight back to your balance.",
    icon: ShieldCheck,
  },
  {
    title: "A wide range of digital products",
    text: "Social media accounts, virtual numbers, eSIMs, data bundles, airtime and gift cards — browse a growing marketplace without opening a separate account for each one.",
    icon: Layers,
  },
  {
    title: "Cheap and pocket friendly",
    text: "Vaultra is built to keep prices low across every category, so you get unique accounts and digital products without paying over the odds.",
    icon: WalletCards,
  },
  {
    title: "Support when you need it",
    text: "Questions about an order, a wallet transaction or your account are handled by a real support channel, not a dead end — so you're never left guessing.",
    icon: Headphones,
  },
];

const journeySteps = [
  {
    title: "Discover accounts & products",
    text: "Browse unique social media accounts, virtual numbers, eSIMs, data plans and more, and use categories to find exactly what you need.",
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
    q: "What is Vaultra?",
    a: "Vaultra is a marketplace where you can discover and buy unique social media accounts, virtual numbers, eSIMs and other digital products online — cheap and pocket friendly. Everything runs through one secure wallet, so you fund your balance once and pay for anything instantly instead of re-entering card details every time.",
  },
  {
    q: "How do I pay for something on Vaultra?",
    a: "Fund your Vaultra wallet using one of the supported payment options, then choose what you want — a social media account, a virtual number, an eSIM or another digital product — and pay directly from your wallet balance at checkout. Orders are processed automatically once payment is confirmed.",
  },
  {
    q: "Is Vaultra safe to use?",
    a: "Yes. Every checkout is wallet-based rather than exposing card details to third-party sellers, your account is protected with authenticated access, and every order and transaction is logged in your dashboard so you can review your full history at any time.",
  },
  {
    q: "What happens if an order fails?",
    a: "If a service provider cannot fulfil an order — for example due to temporary stock or connectivity issues — the amount is automatically credited back to your wallet so you never lose funds on a failed order.",
  },
  {
    q: "Can I use Vaultra on my phone?",
    a: "Yes. Vaultra works as a responsive web app across phones, tablets and desktop browsers, and can be installed to your home screen for quicker access.",
  },
];

export default function HomePage() {
  return (
    <main className="landing">
      <StructuredData faqs={faqs} />
      <div className="landing-grid" />
      <LandingNav />

      <section className="hero">
        <div className="eyebrow"><Sparkles size={14}/> UNIQUE ACCOUNTS & DIGITAL PRODUCTS MARKETPLACE</div>
        <h1>Discover Unique Accounts<br/><span>in our Marketplace</span></h1>
        <p>The Outstanding place to Buy all Social media accounts, Virtual numbers, esim and other digital products cheap and pocket friendly</p>
        <div className="hero-actions">
          <Link className="primary-btn" href="/register">Get Started <ArrowRight size={18}/></Link>
          <Link className="secondary-btn" href="/services">View Marketplace</Link>
        </div>
        <div className="hero-proof"><BadgeCheck size={18}/><span>Secure payments</span><i/> <span>Fast order processing</span><i/> <span>Simple account management</span></div>
      </section>

      <section className="stats" aria-label="Vaultra highlights">
        <div><strong>180<span>+</span></strong><small>Product options</small></div>
        <div><strong>24/7</strong><small>Platform access</small></div>
        <div><strong>100<span>%</span></strong><small>Secure checkout</small></div>
        <div><strong>1</strong><small>Simple dashboard</small></div>
      </section>

      <section id="services" className="section">
        <div className="section-heading"><span>EXPLORE VAULTRA</span><h2>Everything you need,<br/><em>in one dashboard.</em></h2><p>Browse unique accounts and digital products, fund your wallet, place orders and keep track of every transaction without switching platforms.</p></div>
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
          <h2>Built to be the easiest way<br/><em>to buy digital products.</em></h2>
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
        <div><span>BUILT FOR CONVENIENCE</span><h2>A smoother way to manage<br/><em>digital products.</em></h2><p>Vaultra brings discovery, payments, orders and account management together in a clean, secure experience.</p><Link className="primary-btn" href="/register">Create Free Account <ArrowRight size={18}/></Link></div>
        <div className="security-card"><ShieldCheck size={42}/><h3>Designed with security in mind</h3><p>Clear wallet activity, organized orders and protected account access help you stay in control.</p><div className="security-row"><span>Secure access</span><b>Active</b></div><div className="security-row"><span>Order tracking</span><b>Included</b></div></div>
      </section>

      <section id="about" className="section">
        <div className="section-heading">
          <span>ABOUT VAULTRA</span>
          <h2>Why people choose<br/><em>Vaultra.</em></h2>
        </div>
        <p>
          Vaultra was built to solve a simple problem: finding and buying unique social media accounts,
          virtual numbers, eSIMs and other digital products online usually means juggling several
          different apps, re-entering payment details each time, and losing track of what you have
          actually paid for. Vaultra brings all of it into one marketplace, backed by a single wallet
          you fund once and spend from repeatedly.
        </p>
        <p>
          Every order runs through the same secure checkout flow, and every transaction — successful,
          pending or failed — is recorded in your dashboard so you always have a clear history of your
          spending. If a service provider is ever unable to fulfil an order, the amount is automatically
          returned to your wallet, so funds are never left unaccounted for.
        </p>
        <p>
          Vaultra is designed as a mobile-first web app, so the full experience — browsing accounts and
          products, funding your wallet, placing orders and tracking deliveries — works the same way on
          a phone, tablet or desktop browser, and can be installed to your home screen for quicker access.
        </p>
      </section>

      <section id="faq" className="section steps-section">
        <div className="section-heading centered">
          <span>FREQUENTLY ASKED QUESTIONS</span>
          <h2>Common questions about<br/><em>using Vaultra.</em></h2>
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

      <section className="final-cta"><Sparkles size={22}/><h2>Ready to discover<br/><span>unique accounts?</span></h2><p>Create your Vaultra account and explore the marketplace today.</p><Link className="primary-btn" href="/register">Get Started Now <ArrowRight size={18}/></Link></section>

      <footer>
        <Link href="/" className="brand">
          <Image src="/logo.png" alt="Vaultra logo" className="brand-logo" width={140} height={29} priority={false} />
        </Link>
        <p>Unique accounts. Cheap and pocket friendly.</p>
        <div><Link href="/login">Log in</Link><Link href="/register">Create account</Link><Link href="/services">Marketplace</Link></div>
        <p className="footer-note">
          Vaultra processes all orders and wallet transactions for legitimate personal and business use only,
          in line with each service provider&apos;s terms. Thank you for using the platform responsibly.
        </p>
        <small>© {new Date().getFullYear()} Vaultra. All rights reserved.</small>
      </footer>
    </main>
  );
}
