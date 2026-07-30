<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            if (! Schema::hasColumn('services', 'category_id')) {
                $table->foreignId('category_id')
                    ->nullable()
                    ->after('category')
                    ->constrained()
                    ->nullOnDelete();
            }

            // Null stock = unlimited/digital-instant delivery (no physical inventory cap).
            if (! Schema::hasColumn('services', 'stock')) {
                $table->integer('stock')->nullable()->after('price');
            }

            if (! Schema::hasColumn('services', 'currency')) {
                $table->string('currency', 3)->default('NGN')->after('price');
            }
        });
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            if (Schema::hasColumn('services', 'stock')) {
                $table->dropColumn('stock');
            }
            if (Schema::hasColumn('services', 'currency')) {
                $table->dropColumn('currency');
            }
            if (Schema::hasColumn('services', 'category_id')) {
                $table->dropConstrainedForeignId('category_id');
            }
        });
    }
};
