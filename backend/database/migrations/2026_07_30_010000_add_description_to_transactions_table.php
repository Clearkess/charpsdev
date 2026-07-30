<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 2 (Wallet Refinements): the `transactions` table (the one the
 * user-facing Wallet page actually reads via GET /wallet/transactions) has
 * always had a `type` + `gateway` column but no human-readable description,
 * unlike its sibling `wallet_transactions` table. Admin credits/debits and
 * Paystack deposits currently show up as a bare type ("credit"/"deposit")
 * with no context. Adding a nullable `description` here (guarded, additive)
 * lets every money-movement path write a short human-readable note.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (! Schema::hasColumn('transactions', 'description')) {
                $table->string('description')->nullable()->after('gateway');
            }
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (Schema::hasColumn('transactions', 'description')) {
                $table->dropColumn('description');
            }
        });
    }
};
