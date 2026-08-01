<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VirtualNumberOrder;
use App\Services\SmsProviders\SmsProviderException;
use App\Services\VirtualNumberService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Phase 7 (Provider API Sync) follow-up: browse/buy/track virtual
 * numbers rented from 5SIM / SMS-Man / OnlineSIM to receive an SMS OTP.
 * Deliberately "provider-scoped" (pick a provider -> its own countries
 * -> its own services) rather than a unified cross-provider comparison,
 * since the three providers use incompatible country/service coding
 * schemes (see VirtualNumberService::ADAPTERS doc block).
 */
class VirtualNumberController extends Controller
{
    public function __construct(private readonly VirtualNumberService $service)
    {
    }

    public function providers()
    {
        return response()->json([
            'success' => true,
            'data' => $this->service->activeProviders(),
        ]);
    }

    public function countries(Request $request, string $provider)
    {
        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->listCountries($provider),
            ]);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'message' => collect($e->errors())->flatten()->first()], 422);
        } catch (SmsProviderException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 502);
        }
    }

    public function services(Request $request, string $provider)
    {
        $data = $request->validate(['country' => 'required|string']);

        try {
            return response()->json([
                'success' => true,
                'data' => $this->service->listServices($provider, $data['country']),
            ]);
        } catch (ValidationException $e) {
            return response()->json(['success' => false, 'message' => collect($e->errors())->flatten()->first()], 422);
        } catch (SmsProviderException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 502);
        }
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'provider' => 'required|string',
            'country' => 'required|string',
            'service' => 'required|string',
        ]);

        try {
            $order = $this->service->buyNumber($request->user(), $data['provider'], $data['country'], $data['service']);

            return response()->json([
                'success' => true,
                'message' => 'Number rented successfully. Waiting for the SMS code…',
                'data' => $order,
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => collect($e->errors())->flatten()->first() ?? 'Could not rent a number.',
            ], 422);
        }
    }

    public function index(Request $request)
    {
        $orders = VirtualNumberOrder::where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->paginate(15);

        return response()->json(['success' => true, 'data' => $orders]);
    }

    public function show(Request $request, VirtualNumberOrder $virtualNumberOrder)
    {
        $this->authorizeOwner($request, $virtualNumberOrder);

        return response()->json(['success' => true, 'data' => $virtualNumberOrder]);
    }

    /** Polls the provider once and returns the (possibly updated) order. */
    public function poll(Request $request, VirtualNumberOrder $virtualNumberOrder)
    {
        $this->authorizeOwner($request, $virtualNumberOrder);

        $order = $this->service->pollStatus($virtualNumberOrder);

        return response()->json(['success' => true, 'data' => $order]);
    }

    public function cancel(Request $request, VirtualNumberOrder $virtualNumberOrder)
    {
        $this->authorizeOwner($request, $virtualNumberOrder);

        if (! $virtualNumberOrder->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'This order is already finished and cannot be cancelled.',
            ], 422);
        }

        $order = $this->service->cancelOrder($virtualNumberOrder);

        return response()->json([
            'success' => true,
            'message' => 'Order cancelled and refunded to your wallet.',
            'data' => $order,
        ]);
    }

    private function authorizeOwner(Request $request, VirtualNumberOrder $order): void
    {
        abort_if($order->user_id !== $request->user()->id, 403, 'This order does not belong to you.');
    }
}
