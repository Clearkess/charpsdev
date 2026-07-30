<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('order_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('service_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->unsignedInteger('quantity')->default(1);

            // Unit price at time of purchase (snapshot, protects historical
            // order totals from later service price changes).
            $table->decimal('price', 15, 2);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
