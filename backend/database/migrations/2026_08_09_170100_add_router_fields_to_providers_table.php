<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Provider Router (Option A), step 1: extends the existing `providers`
     * table (name/slug/base_url/api_key/active — untouched, kept for
     * backward compat with VirtualNumberService's direct-slug lookups) with
     * the fields the new ProviderRouter/ProviderHealthService need to pick
     * a healthy provider for a service and track its live health signal.
     *
     * - category: which fulfilment domain this provider serves (vtu,
     *   giftcard, verification, ...). Free string, deliberately not a DB
     *   enum/CHECK constraint (see the services.category precedent in
     *   2026_07_30_003700_widen_services_category_check_constraint.php —
     *   Postgres enums here have already caused one painful migration to
     *   walk back), so new categories never require a schema change.
     * - priority: a provider's own tie-break/default ordering hint when it's
     *   not yet attached to a specific service_provider_routes row (mostly
     *   informational — the real per-service ordering lives on
     *   service_provider_routes.priority).
     * - is_primary / is_backup: coarse, human-facing labels for the Admin UI
     *   ("PRIMARY"/"BACKUP" badges) — NOT what ProviderRouter uses to decide
     *   failover order (that's service_provider_routes.priority, lower =
     *   tried first). Kept as plain flags rather than derived from priority
     *   so an admin can label a provider without it silently changing route
     *   ordering.
     * - health_status: 'healthy' | 'degraded' | 'offline', updated by
     *   ProviderHealthService from both passive call outcomes and active
     *   health-check pings. ProviderRouter only considers 'healthy' rows.
     * - failure_count / success_count: lifetime counters (never reset),
     *   used to compute the Admin UI's success-rate %.
     * - last_success_at / last_failure_at: most recent outcome timestamps,
     *   surfaced in the Admin UI and used by ProviderHealthService to decide
     *   whether a 'degraded' provider has recovered.
     * - last_health_check_at: last time an active health-check ping ran
     *   against this provider, independent of real order traffic.
     * - cooldown_until: when set (and in the future), ProviderRouter skips
     *   this provider even if health_status is still 'healthy' — set after
     *   a failure to avoid hammering a provider that's likely still down
     *   for a short grace period, without immediately flipping it to
     *   'offline' on a single blip.
     * - timeout_seconds: per-provider HTTP timeout override for the adapter
     *   call (falls back to a sane default in ProviderRouter/the adapter
     *   itself when null).
     */
    public function up(): void
    {
        Schema::table('providers', function (Blueprint $table) {
            if (! Schema::hasColumn('providers', 'category')) {
                $table->string('category')->nullable()->after('slug');
            }
            if (! Schema::hasColumn('providers', 'priority')) {
                $table->unsignedInteger('priority')->default(100)->after('active');
            }
            if (! Schema::hasColumn('providers', 'is_primary')) {
                $table->boolean('is_primary')->default(false)->after('priority');
            }
            if (! Schema::hasColumn('providers', 'is_backup')) {
                $table->boolean('is_backup')->default(false)->after('is_primary');
            }
            if (! Schema::hasColumn('providers', 'health_status')) {
                $table->string('health_status')->default('healthy')->after('is_backup');
            }
            if (! Schema::hasColumn('providers', 'failure_count')) {
                $table->unsignedInteger('failure_count')->default(0)->after('health_status');
            }
            if (! Schema::hasColumn('providers', 'success_count')) {
                $table->unsignedInteger('success_count')->default(0)->after('failure_count');
            }
            if (! Schema::hasColumn('providers', 'last_success_at')) {
                $table->timestamp('last_success_at')->nullable()->after('success_count');
            }
            if (! Schema::hasColumn('providers', 'last_failure_at')) {
                $table->timestamp('last_failure_at')->nullable()->after('last_success_at');
            }
            if (! Schema::hasColumn('providers', 'last_health_check_at')) {
                $table->timestamp('last_health_check_at')->nullable()->after('last_failure_at');
            }
            if (! Schema::hasColumn('providers', 'cooldown_until')) {
                $table->timestamp('cooldown_until')->nullable()->after('last_health_check_at');
            }
            if (! Schema::hasColumn('providers', 'timeout_seconds')) {
                $table->unsignedInteger('timeout_seconds')->nullable()->after('cooldown_until');
            }
        });
    }

    public function down(): void
    {
        Schema::table('providers', function (Blueprint $table) {
            foreach ([
                'category', 'priority', 'is_primary', 'is_backup', 'health_status',
                'failure_count', 'success_count', 'last_success_at', 'last_failure_at',
                'last_health_check_at', 'cooldown_until', 'timeout_seconds',
            ] as $column) {
                if (Schema::hasColumn('providers', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
