<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->uuid('checkout_key')->nullable();
            $table->string('checkout_request_hash', 64)->nullable();

            $table->unique(
                ['user_id', 'checkout_key'],
                'orders_user_checkout_key_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique('orders_user_checkout_key_unique');
            $table->dropColumn([
                'checkout_key',
                'checkout_request_hash',
            ]);
        });
    }
};
