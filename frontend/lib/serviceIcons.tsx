import type { ComponentType, SVGProps } from "react";
import {
  FingerprintIcon,
  GiftIcon,
  MailIcon,
  PackageIcon,
  SmartphoneIcon,
  TvIcon,
  WifiIcon,
  ZapIcon,
} from "lucide-react";
import {
  SiFacebook,
  SiGmail,
  SiInstagram,
  SiItunes,
  SiNetflix,
  SiSpotify,
  SiSteam,
  SiTelegram,
  SiTiktok,
  SiWhatsapp,
  SiX,
} from "react-icons/si";
import type { Category, Service } from "@/types/api";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Maps a service/category to a small brand-ish icon plus a background/text
 * color pair, so the Services grid can show a colorful icon bubble per card
 * (inspired by the Tnxverify reference design) without needing a dedicated
 * `icon` field on every service row. Resolution order:
 *   1. Brand keyword match against the service name (most specific — e.g.
 *      "Netflix Premium" gets the actual Netflix glyph).
 *   2. The linked category's seeded `icon` string (facebook/instagram/...).
 *   3. The legacy `category` enum string (vtu/giftcard/esim/...).
 *   4. A generic package icon as the final fallback.
 */
type IconMatch = { Icon: IconComponent; className: string };

const BRAND_KEYWORDS: Array<{ pattern: RegExp; Icon: IconComponent; className: string }> = [
  { pattern: /facebook/i, Icon: SiFacebook, className: "bg-blue-500/10 text-blue-600" },
  { pattern: /instagram/i, Icon: SiInstagram, className: "bg-pink-500/10 text-pink-600" },
  { pattern: /tiktok/i, Icon: SiTiktok, className: "bg-neutral-800/10 text-neutral-800 dark:bg-white/10 dark:text-white" },
  { pattern: /twitter|\bx\b/i, Icon: SiX, className: "bg-neutral-800/10 text-neutral-800 dark:bg-white/10 dark:text-white" },
  { pattern: /telegram/i, Icon: SiTelegram, className: "bg-sky-500/10 text-sky-600" },
  { pattern: /whatsapp/i, Icon: SiWhatsapp, className: "bg-emerald-500/10 text-emerald-600" },
  { pattern: /gmail/i, Icon: SiGmail, className: "bg-red-500/10 text-red-600" },
  { pattern: /outlook|email|mail/i, Icon: MailIcon, className: "bg-red-500/10 text-red-600" },
  { pattern: /netflix/i, Icon: SiNetflix, className: "bg-red-600/10 text-red-600" },
  { pattern: /spotify/i, Icon: SiSpotify, className: "bg-green-500/10 text-green-600" },
  { pattern: /steam/i, Icon: SiSteam, className: "bg-slate-500/10 text-slate-600" },
  { pattern: /itunes|apple/i, Icon: SiItunes, className: "bg-neutral-500/10 text-neutral-600" },
  { pattern: /verif|bvn|nin\b/i, Icon: FingerprintIcon, className: "bg-violet-500/10 text-violet-600" },
  { pattern: /electric|dstv|gotv|bill/i, Icon: ZapIcon, className: "bg-orange-500/10 text-orange-600" },
  { pattern: /esim/i, Icon: WifiIcon, className: "bg-cyan-500/10 text-cyan-600" },
  { pattern: /airtime|data bundle|mtn|glo|airtel|9mobile/i, Icon: SmartphoneIcon, className: "bg-emerald-500/10 text-emerald-600" },
  { pattern: /gift ?card/i, Icon: GiftIcon, className: "bg-amber-500/10 text-amber-600" },
];

const CATEGORY_ICON_MAP: Record<string, { Icon: IconComponent; className: string }> = {
  facebook: { Icon: SiFacebook, className: "bg-blue-500/10 text-blue-600" },
  instagram: { Icon: SiInstagram, className: "bg-pink-500/10 text-pink-600" },
  tiktok: { Icon: SiTiktok, className: "bg-neutral-800/10 text-neutral-800 dark:bg-white/10 dark:text-white" },
  twitter: { Icon: SiX, className: "bg-neutral-800/10 text-neutral-800 dark:bg-white/10 dark:text-white" },
  mail: { Icon: MailIcon, className: "bg-red-500/10 text-red-600" },
  tv: { Icon: TvIcon, className: "bg-purple-500/10 text-purple-600" },
  gift: { Icon: GiftIcon, className: "bg-amber-500/10 text-amber-600" },
  package: { Icon: PackageIcon, className: "bg-indigo-500/10 text-indigo-600" },
};

const LEGACY_CATEGORY_ICON_MAP: Record<string, { Icon: IconComponent; className: string }> = {
  vtu: { Icon: SmartphoneIcon, className: "bg-emerald-500/10 text-emerald-600" },
  giftcard: { Icon: GiftIcon, className: "bg-amber-500/10 text-amber-600" },
  esim: { Icon: WifiIcon, className: "bg-cyan-500/10 text-cyan-600" },
  verification: { Icon: FingerprintIcon, className: "bg-violet-500/10 text-violet-600" },
  digital: { Icon: PackageIcon, className: "bg-indigo-500/10 text-indigo-600" },
  utility: { Icon: ZapIcon, className: "bg-orange-500/10 text-orange-600" },
  social: { Icon: PackageIcon, className: "bg-indigo-500/10 text-indigo-600" },
  email: { Icon: MailIcon, className: "bg-red-500/10 text-red-600" },
  streaming: { Icon: TvIcon, className: "bg-purple-500/10 text-purple-600" },
};

const DEFAULT_ICON: IconMatch = { Icon: PackageIcon, className: "bg-primary/10 text-primary" };

export function getServiceIcon(service: Pick<Service, "name" | "category" | "category_group">): IconMatch {
  const nameMatch = BRAND_KEYWORDS.find(({ pattern }) => pattern.test(service.name));
  if (nameMatch) return nameMatch;

  const categoryIcon = service.category_group?.icon;
  if (categoryIcon && CATEGORY_ICON_MAP[categoryIcon]) return CATEGORY_ICON_MAP[categoryIcon];

  const legacy = service.category;
  if (legacy && LEGACY_CATEGORY_ICON_MAP[legacy]) return LEGACY_CATEGORY_ICON_MAP[legacy];

  return DEFAULT_ICON;
}

export function getCategoryIcon(category: Pick<Category, "icon">): IconMatch {
  if (category.icon && CATEGORY_ICON_MAP[category.icon]) return CATEGORY_ICON_MAP[category.icon];
  return DEFAULT_ICON;
}

/**
 * Services whose (legacy) category represents a top-up/bill-payment style
 * product — the listed price is a base/minimum amount rather than a fixed
 * price, since the real amount is chosen at purchase time (e.g. "top up any
 * amount from ₦500"). These get a "Starting from ₦..." label instead of a
 * flat price tag.
 */
export function hasVariablePricing(service: Pick<Service, "category">): boolean {
  return service.category === "vtu" || service.category === "utility" || service.category === "esim";
}
