<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::create('services', function (Blueprint $table) {
        $table->id();

        $table->string('name');

        $table->string('slug')->unique();

        $table->enum('category', [
            'vtu',
            'giftcard',
            'esim',
            'verification',
            'digital',
            'utility'
        ]);

        $table->text('description')->nullable();

        $table->decimal('price', 15, 2);

        $table->boolean('active')->default(true);

        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};
