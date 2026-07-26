<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->string('gateway'); // flutterwave, paystack

            $table->string('reference')->unique();

            $table->decimal('amount', 15, 2);

            $table->string('currency')->default('NGN');

            $table->enum('status', [
                'pending',
                'successful',
                'failed'
            ])->default('pending');

            $table->json('gateway_response')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
