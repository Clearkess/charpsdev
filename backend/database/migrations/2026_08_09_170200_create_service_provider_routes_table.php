<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Provider Router (Option A), step 1: the per-service failover chain.
     * `services.provider_id` (single FK) is left untouched for backward
     * compat — any code still reading it keeps working — but ProviderRouter
     * reads routing exclusively from this table, so a service can have any
     * number of ordered provider attempts instead of exactly one.
     *
     * priority: lower number = tried first (1 = primary). Deliberately NOT
     * given a unique(['service_id','priority']) constraint: a disabled
     * route (enabled=false) legitimately parking at the same priority as
     * an enabled one (e.g. while an admin is mid-reorder in the future
     * routing-editor UI) must not throw a DB error. ProviderRouter's query
     * already filters to enabled+healthy rows before ordering, so a
     * transient duplicate priority among disabled rows can never affect
     * real failover order.
     *
     * unique(['service_id','provider_id']): a given provider can only
     * appear once in a given service's chain — prevents an admin (or a
     * buggy future reorder endpoint) from accidentally double-listing the
     * same provider at two priorities.
     */
    public function up(): void
    {
        Schema::create('service_provider_routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->foreignId('provider_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('priority')->default(100);
            $table->boolean('enabled')->default(true);
            // The provider's own identifier for this service (e.g. VTpass's
            // product/variation code) — never assumed to equal our own
            // services.slug, since each provider names things differently.
            $table->string('provider_service_id')->nullable();
            $table->decimal('provider_cost', 15, 4)->nullable();
            $table->unsignedInteger('failure_count')->default(0);
            $table->unsignedInteger('success_count')->default(0);
            $table->timestamp('last_success_at')->nullable();
            $table->timestamp('last_failure_at')->nullable();
            $table->timestamps();

            $table->unique(['service_id', 'provider_id']);
            $table->index(['service_id', 'enabled', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_provider_routes');
    }
};
