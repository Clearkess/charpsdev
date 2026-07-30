<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Adds cart-checkout-oriented fields alongside the existing single-item
     * order fields (reference, amount, service_id, quantity) so both the
     * legacy single-service "Create order" flow and the new multi-item cart
     * checkout flow can coexist without breaking existing rows/consumers.
     *
     * - order_number: mirrors `reference` for orders created via checkout
     *   (kept distinct per the product spec, but always set to the same
     *   value as `reference` so any code reading either field works).
     * - total: mirrors `amount` for the same reason.
     * - payment_method: how the order was paid for (e.g. "wallet").
     * - service_id/quantity become nullable: a multi-item cart-checkout
     *   order has no single service/quantity of its own (its breakdown
     *   lives in `order_items`), while single-service orders created via
     *   the legacy `OrderController::store()` flow keep populating them
     *   exactly as before.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'order_number')) {
                $table->string('order_number')->nullable()->unique()->after('reference');
            }
            if (! Schema::hasColumn('orders', 'total')) {
                $table->decimal('total', 15, 2)->nullable()->after('amount');
            }
            if (! Schema::hasColumn('orders', 'payment_method')) {
                $table->string('payment_method')->nullable()->after('status');
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('service_id')->nullable()->change();
            $table->unsignedInteger('quantity')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            foreach (['order_number', 'total', 'payment_method'] as $column) {
                if (Schema::hasColumn('orders', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
