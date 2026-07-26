<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordNotification extends ResetPassword
{
    public function toMail($notifiable)
    {
        $url = env('FRONTEND_URL') .
            '/reset-password?token=' . $this->token .
            '&email=' . urlencode($notifiable->email);

        return (new MailMessage)
            ->subject('Reset Your Password')
            ->greeting('Hello!')
            ->line('You requested a password reset.')
            ->action('Reset Password', $url)
            ->line('If you did not request this, you can safely ignore this email.');
    }
}
