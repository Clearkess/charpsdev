<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Provider Router (Option A), step 1: append-only history of both
     * active health-check pings (ProviderHealthService) and passive outcome
     * observations (every real ProviderRouter attempt, success or failure)
     * against a provider. Never updated in place, no unique constraints —
     * this is a log, not current state (current state lives on
     * providers.health_status/failure_count/etc, which this log feeds).
     *
     * Deliberately NOT given a foreign key ON DELETE CASCADE index beyond
     * the FK itself: this table is expected to grow fast and get pruned
     * periodically (flagged in my review of the original proposal — a
     * scheduled command to trim rows older than N days is a follow-up, not
     * part of Option A).
     */
    public function up(): void
    {
        Schema::create('provider_health_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('provider_id')->constrained()->cascadeOnDelete();
            // 'healthy' | 'degraded' | 'offline' — same vocabulary as
            // providers.health_status, but this row is a point-in-time
            // observation, not the provider's current aggregate state.
            $table->string('status');
            $table->unsignedInteger('response_time_ms')->nullable();
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->string('error_code')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('checked_at');
            $table->timestamps();

            $table->index(['provider_id', 'checked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('provider_health_checks');
    }
};
