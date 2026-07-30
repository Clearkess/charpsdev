<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Service;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function index(Request $request)
    {
        $query = Service::query()
            ->with('categoryGroup')
            ->where('active', true);

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->integer('category_id'));
        } elseif ($request->filled('category')) {
            // Accept either the legacy category string or a category slug.
            $slug = $request->string('category')->toString();

            $query->where(function ($q) use ($slug) {
                $q->where('category', $slug)
                    ->orWhereHas('categoryGroup', function ($cq) use ($slug) {
                        $cq->where('slug', $slug);
                    });
            });
        }

        return response()->json([
            'success' => true,
            'services' => $query->latest()->get(),
        ]);
    }
}
