<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Phase 7 (Provider API Sync) follow-up: virtual-number/SMS-OTP rentals
     * from 5SIM / SMS-Man / OnlineSIM have a fundamentally different
     * lifecycle than the static `services` catalog (rent number -> poll
     * for an async inbound SMS code -> finish/cancel), and live,
     * constantly-shifting country x service x operator pricing rather than
     * a fixed catalog row. A dedicated table keeps that lifecycle out of
     * `orders`/`services` instead of overloading their existing shape.
     */
    public function up(): void
    {
        Schema::create('virtual_number_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Nullable: the provider row it was bought against may later be
            // deleted/deactivated by an admin; we keep provider_slug as the
            // durable, human-readable record of which API fulfilled it.
            $table->foreignId('provider_id')->nullable()->constrained('providers')->nullOnDelete();
            $table->string('provider_slug');
            // The provider's own order/activation id, used for every
            // status/finish/cancel call back to that provider's API.
            $table->string('external_id');
            $table->string('phone_number')->nullable();
            $table->string('country');
            $table->string('service_code');
            $table->string('service_name')->nullable();
            $table->string('operator')->nullable();
            $table->decimal('cost_usd', 10, 4);
            // Snapshotted at purchase time so a later admin change to the
            // live Setting never retroactively changes what a past order
            // actually charged the customer.
            $table->decimal('exchange_rate', 10, 4);
            $table->decimal('markup_percent', 5, 2);
            $table->decimal('price_ngn', 12, 2);
            $table->string('currency', 8)->default('NGN');
            $table->enum('status', [
                'pending', 'waiting_code', 'received', 'cancelled', 'expired', 'refunded', 'failed',
            ])->default('pending');
            $table->string('sms_code')->nullable();
            $table->text('sms_text')->nullable();
            $table->string('reference')->unique();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['provider_slug', 'external_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('virtual_number_orders');
    }
};
