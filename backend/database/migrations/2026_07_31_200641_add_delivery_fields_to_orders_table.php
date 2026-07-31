<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Phase 5 (product delivery emails): additive/nullable columns so an
     * admin can attach the actual delivered content (license key, PIN,
     * download link, account credentials, etc.) to an order. `delivered_at`
     * tracks the first time an order was marked completed, so a repeat save
     * of an already-completed order doesn't re-fire the delivery email
     * unless the delivery content itself actually changed (see
     * AdminOrderController::update()).
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'delivery_content')) {
                $table->text('delivery_content')->nullable()->after('details');
            }
            if (! Schema::hasColumn('orders', 'delivered_at')) {
                $table->timestamp('delivered_at')->nullable()->after('delivery_content');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'delivered_at')) {
                $table->dropColumn('delivered_at');
            }
            if (Schema::hasColumn('orders', 'delivery_content')) {
                $table->dropColumn('delivery_content');
            }
        });
    }
};
