<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The original services table (2026_07_20_164349_create_services_table.php)
 * defined `category` via Laravel's enum() column type, restricted to
 * ['vtu','giftcard','esim','verification','digital','utility']. On Postgres
 * this is implemented as a CHECK constraint (services_category_check); on
 * SQLite it's not enforced at all, which is why this was never caught in
 * local dev testing.
 *
 * Phase 1's marketplace category expansion (backend/database/seeders/
 * DemoDataSeeder.php) introduces new legacy category string values
 * ('social', 'email') for the new social/email-account catalog items,
 * which violates the original Postgres CHECK constraint. Since `category`
 * is now explicitly documented as a legacy free-text fallback column (the
 * real, extensible categorization lives in `category_id` -> `categories`),
 * this migration drops the CHECK constraint on Postgres so the column
 * behaves as a plain string going forward, matching its documented role.
 *
 * No-op on SQLite/MySQL (no such constraint exists there).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        $constraintExists = DB::selectOne(
            "SELECT 1 FROM pg_constraint WHERE conname = 'services_category_check'"
        );

        if ($constraintExists) {
            DB::statement('ALTER TABLE services DROP CONSTRAINT services_category_check');
        }
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        // Restore the original constraint, but widened to also allow the
        // Phase 1 legacy values already in use ('social', 'email'), so a
        // rollback doesn't strand existing Phase 1 rows in a broken state.
        DB::statement(<<<'SQL'
            ALTER TABLE services
            ADD CONSTRAINT services_category_check
            CHECK (category::text = ANY (ARRAY[
                'vtu', 'giftcard', 'esim', 'verification', 'digital', 'utility',
                'social', 'email'
            ]::text[]))
        SQL);
    }
};
