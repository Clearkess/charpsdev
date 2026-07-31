<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Additive/nullable, same discipline as the checkout-fields
            // migration: records what coupon (if any) was applied to this
            // order and how much was discounted, without touching any
            // existing column or the pre-existing single-item order flow.
            if (! Schema::hasColumn('orders', 'coupon_code')) {
                $table->string('coupon_code')->nullable()->after('total');
            }
            if (! Schema::hasColumn('orders', 'discount')) {
                $table->decimal('discount', 12, 2)->nullable()->after('coupon_code');
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['coupon_code', 'discount']);
        });
    }
};
