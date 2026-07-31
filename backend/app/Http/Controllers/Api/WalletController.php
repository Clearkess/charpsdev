<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DepositRequest;
use App\Models\Transaction;
use App\Models\Wallet;
use Illuminate\Http\Request;

class WalletController extends Controller
{
    public function index(Request $request)
    {
        $wallet = Wallet::firstOrCreate(
            ['user_id' => $request->user()->id],
            ['balance' => 0, 'currency' => 'NGN']
        );

        return response()->json([
            'success' => true,
            'data' => $wallet,
        ]);
    }

    public function deposit(DepositRequest $request, PaymentController $paymentController)
    {
        return $paymentController->initialize($request);
    }

    public function transactions(Request $request)
    {
        $transactions = Transaction::where('user_id', $request->user()->id)
            ->with('order:id,reference,order_number,status')
            ->latest()
            ->paginate(20);

        // Only purchase-type transactions are expected to resolve an order
        // (see Transaction::order() for why other types naturally won't).
        $transactions->getCollection()->each(function (Transaction $transaction) {
            if ($transaction->type !== 'purchase') {
                $transaction->setRelation('order', null);
            }
        });

        return response()->json([
            'success' => true,
            'data' => $transactions,
        ]);
    }
}
