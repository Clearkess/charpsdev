<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Payment/dispute hardening: `transactions` (deposit/purchase/refund/
 * admin-credit/admin-debit ledger, see Transaction model + PaymentController
 * /CheckoutController/AdminWalletController/OrderFulfillmentService) had no
 * currency column (every amount was implicitly assumed NGN), no structured
 * gateway reference or idempotency guard beyond the `reference` unique
 * index, and no place to record *why* a payment failed. All additions here
 * are nullable/additive — no backfill needed, no existing write site breaks
 * (Transaction::create() calls simply won't populate the new columns until
 * a follow-up wires them in, which is safe since every column is nullable).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (! Schema::hasColumn('transactions', 'currency')) {
                // 3-letter ISO 4217 code (NGN, GHS, USD, ...). Nullable rather
                // than a hard NOT NULL default so this migration never fails
                // on existing rows; application code should always set it
                // going forward (defaults to 'NGN' at the write site, not
                // the schema, since that's where the actual currency is known).
                $table->string('currency', 3)->nullable()->after('amount');
            }

            if (! Schema::hasColumn('transactions', 'gateway_reference')) {
                // The gateway's OWN reference/transaction id (e.g. Paystack's
                // `id`/`reference` from the verify/webhook payload), distinct
                // from our own internally-generated `reference` column —
                // needed to look up a charge on the gateway's dashboard
                // during a dispute/chargeback without guessing at a mapping.
                $table->string('gateway_reference')->nullable()->after('gateway');
            }

            if (! Schema::hasColumn('transactions', 'idempotency_key')) {
                // Optional caller-supplied idempotency key for payment
                // initiation flows that want a stronger guarantee than the
                // existing `reference`-uniqueness check (e.g. a client retry
                // with the same key must never double-charge/double-credit).
                $table->string('idempotency_key')->nullable()->unique()->after('gateway_reference');
            }

            if (! Schema::hasColumn('transactions', 'failure_reason')) {
                // Human-readable reason a payment/refund failed or was
                // rejected (gateway error message, validation failure,
                // provider rejection, etc.) — currently that context only
                // ever reached the application log, not the ledger row
                // itself, which is exactly what's needed on a dispute.
                $table->text('failure_reason')->nullable()->after('status');
            }
        });

        // Composite index for the most common dispute/support lookup shape:
        // "this user's transactions, in this status, over this period" —
        // e.g. AdminWalletController::transactions() and the user-facing
        // Wallet page both filter by user_id and effectively sort/paginate
        // by recency; adding status keeps a chargeback review ("find this
        // user's failed/refunded transactions around this date") indexed too.
        Schema::table('transactions', function (Blueprint $table) {
            if (! $this->indexExists('transactions', 'transactions_user_status_created_idx')) {
                $table->index(['user_id', 'status', 'created_at'], 'transactions_user_status_created_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if ($this->indexExists('transactions', 'transactions_user_status_created_idx')) {
                $table->dropIndex('transactions_user_status_created_idx');
            }

            foreach (['currency', 'gateway_reference', 'idempotency_key', 'failure_reason'] as $column) {
                if (Schema::hasColumn('transactions', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    /**
     * Schema::hasColumn() has no built-in index equivalent, and this
     * migration must stay re-run-safe (guarded, additive) like its
     * predecessors in this table — checked against the actual DB driver
     * rather than assuming MySQL vs. Postgres index-listing syntax.
     */
    private function indexExists(string $table, string $indexName): bool
    {
        $connection = Schema::getConnection();
        $driver = $connection->getDriverName();

        if ($driver === 'pgsql') {
            return ! empty($connection->select(
                'select indexname from pg_indexes where tablename = ? and indexname = ?',
                [$table, $indexName]
            ));
        }

        if ($driver === 'sqlite') {
            return ! empty($connection->select(
                "select name from sqlite_master where type = 'index' and tbl_name = ? and name = ?",
                [$table, $indexName]
            ));
        }

        // MySQL / MariaDB
        return ! empty($connection->select(
            'show index from `'.$table.'` where Key_name = ?',
            [$indexName]
        ));
    }
};
