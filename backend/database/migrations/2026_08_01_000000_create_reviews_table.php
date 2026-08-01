<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Phase 9 (user-facing features): service reviews/ratings. A user may
     * leave exactly one review per service (enforced by the unique index
     * below) — resubmitting is an update, not a new row, so the average
     * rating a service shows can't be inflated by the same buyer rating it
     * repeatedly. `order_id` records which purchase earned the right to
     * review (see ReviewController::store()'s eligibility check) but is
     * nullable so a review is never lost if that order is later deleted.
     */
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'service_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};
