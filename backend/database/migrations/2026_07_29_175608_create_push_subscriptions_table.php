<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $table) {

            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->text('endpoint');

            // SHA-256 hash of the endpoint, used for uniqueness lookups since
            // MySQL cannot index a TEXT column directly.
            $table->string('endpoint_hash', 64);

            $table->string('public_key');

            $table->string('auth_token');

            $table->string('content_encoding')->default('aesgcm');

            $table->timestamps();

            $table->unique(['user_id', 'endpoint_hash'], 'push_subscriptions_user_endpoint_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
