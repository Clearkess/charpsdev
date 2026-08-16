"use client";

/**
 * Floating WhatsApp + Telegram support buttons, rendered globally (mounted
 * in AppProviders so it shows on every route — landing page, dashboard,
 * auth pages, public /services, etc.) since support access shouldn't
 * depend on being logged in or on a specific page.
 *
 * Both channels currently share the same contact number (+2347056606129).
 * WhatsApp's `wa.me` deep link accepts a bare phone number directly.
 * Telegram's `t.me` scheme is normally username-based, but also supports
 * a phone-number lookup via the `t.me/+<number>` form, which is what's
 * used here since no separate @username was provided — if a dedicated
 * Telegram @username/channel is set up later, swap TELEGRAM_HREF to the
 * standard `https://t.me/<username>` form instead.
 */
const SUPPORT_PHONE_INTL = "2347056606129"; // no leading + or symbols, for wa.me
const WHATSAPP_HREF = `https://wa.me/${SUPPORT_PHONE_INTL}`;
const TELEGRAM_HREF = `https://t.me/+${SUPPORT_PHONE_INTL}`;

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" className="size-6">
      <path d="M16.02 2.667C8.66 2.667 2.687 8.64 2.687 16c0 2.573.71 4.98 1.943 7.037L2.667 29.333l6.483-1.923A13.27 13.27 0 0 0 16.02 29.333c7.36 0 13.334-5.973 13.334-13.333 0-7.36-5.974-13.333-13.334-13.333Zm0 24.253c-2.263 0-4.377-.653-6.15-1.79l-.44-.276-3.85 1.14 1.157-3.75-.29-.457a11.02 11.02 0 0 1-1.717-5.847c0-6.087 4.953-11.04 11.29-11.04 6.01 0 10.977 4.953 10.977 11.04 0 6.087-4.953 10.98-10.977 10.98Zm6.037-8.226c-.33-.166-1.953-.963-2.256-1.073-.303-.113-.523-.166-.743.166-.22.33-.85 1.073-1.043 1.293-.193.22-.386.246-.716.083-.33-.166-1.393-.513-2.65-1.636-.98-.873-1.643-1.95-1.836-2.28-.193-.33-.02-.51.166-.677.166-.166.386-.416.58-.623.193-.207.256-.35.386-.583.13-.233.066-.436-.033-.603-.1-.166-.943-2.267-1.293-3.083-.343-.803-.693-.693-.943-.706-.243-.013-.523-.016-.803-.016-.28 0-.733.103-1.116.516-.383.416-1.463 1.43-1.463 3.487 0 2.057 1.49 4.037 1.696 4.313.206.276 2.85 4.353 6.913 5.933 4.063 1.58 4.063 1.053 4.796.986.733-.066 2.36-.966 2.693-1.9.333-.933.333-1.733.233-1.9-.1-.166-.363-.266-.766-.466Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" className="size-6">
      <path d="M16 2.667C8.64 2.667 2.667 8.64 2.667 16S8.64 29.333 16 29.333 29.333 23.36 29.333 16 23.36 2.667 16 2.667Zm6.44 8.987-2.15 10.14c-.163.72-.586.897-1.19.56l-3.29-2.427-1.587 1.53c-.176.176-.323.323-.66.323l.236-3.343 6.083-5.5c.264-.236-.057-.366-.41-.13l-7.517 4.734-3.237-1.014c-.703-.22-.717-.703.146-1.04l12.65-4.877c.586-.22 1.1.13.926 1.044Z" />
    </svg>
  );
}

export default function SupportButtons() {
  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      <a
        href={TELEGRAM_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Vaultra support on Telegram"
        className="flex size-12 items-center justify-center rounded-full bg-[#26A5E4] text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26A5E4]"
      >
        <TelegramIcon />
      </a>
      <a
        href={WHATSAPP_HREF}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Vaultra support on WhatsApp"
        className="flex size-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
      >
        <WhatsAppIcon />
      </a>
    </div>
  );
}
