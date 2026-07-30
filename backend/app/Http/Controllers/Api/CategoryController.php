<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;

class CategoryController extends Controller
{
    /**
     * Public list of active categories, for the marketplace category grid /
     * filter dropdown. Includes an `active_services_count` so the frontend
     * can show a count badge without an extra request.
     */
    public function index()
    {
        $categories = Category::query()
            ->where('status', true)
            ->withCount(['services as active_services_count' => function ($query) {
                $query->where('active', true);
            }])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }
}
