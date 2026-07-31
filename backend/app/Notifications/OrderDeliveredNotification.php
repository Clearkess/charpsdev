<?php

namespace App\Notifications;

use App\Models\Order;
use App\Models\Setting;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Phase 5 (product delivery emails). Sent to the customer when an order is
 * marked "completed" by an admin, optionally carrying whatever the admin
 * typed into the order's `delivery_content` field (a license key, PIN,
 * download link, account credentials, etc.).
 *
 * Not queued — this project has no queue worker process in production
 * (Railway only runs `php artisan serve`; see Procfile/railway.json), so a
 * ShouldQueue notification would silently never send. Sent synchronously,
 * same as the existing ResetPasswordNotification.
 */
class OrderDeliveredNotification extends Notification
{
    public function __construct(private readonly Order $order)
    {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $order = $this->order;
        $supportEmail = Setting::get('support_email');

        $mail = (new MailMessage)
            ->subject("Your order {$order->reference} has been delivered")
            ->greeting('Hello ' . ($notifiable->name ?? 'there') . '!')
            ->line("Great news — your order **{$order->reference}** has been delivered.");

        foreach ($this->lineItems() as $line) {
            $mail->line($line);
        }

        $total = $order->total ?? $order->amount;
        if ($total !== null) {
            $mail->line('**Order total:** ' . number_format((float) $total, 2) . ' NGN');
        }

        if (filled($order->delivery_content)) {
            $mail->line('---')->line('**Delivery details:**');

            // Each line becomes its own paragraph — MailMessage::line()
            // renders as a single <p>, and HTML collapses embedded "\n"s,
            // so a multi-line code/credentials block would otherwise be
            // squashed onto one unreadable line.
            foreach (preg_split('/\r\n|\r|\n/', $order->delivery_content) as $line) {
                if ($line !== '') {
                    $mail->line($line);
                }
            }
        }

        $mail->line(
            $supportEmail
                ? "If you have any questions about this order, contact us at {$supportEmail}."
                : 'If you have any questions about this order, please reach out to support.',
        );

        return $mail;
    }

    /**
     * Builds human-readable "- Service name x2" lines for whichever order
     * shape this order actually has: the cart-checkout path (order_items
     * rows + details.items), or the legacy single-service order path
     * (order.service + order.quantity only, no order_items rows).
     *
     * @return array<int, string>
     */
    private function lineItems(): array
    {
        $order = $this->order;

        if ($order->relationLoaded('items') && $order->items->isNotEmpty()) {
            return $order->items
                ->map(fn ($item) => sprintf('- %s x%d', $item->service?->name ?? 'Item', $item->quantity))
                ->all();
        }

        $detailItems = $order->details['items'] ?? null;
        if (is_array($detailItems) && $detailItems !== []) {
            return collect($detailItems)
                ->map(fn ($item) => sprintf('- %s x%d', $item['service_name'] ?? 'Item', $item['quantity'] ?? 1))
                ->all();
        }

        $serviceName = $order->details['service_name'] ?? $order->service?->name ?? 'Item';

        return [sprintf('- %s x%d', $serviceName, $order->quantity ?? 1)];
    }
}
