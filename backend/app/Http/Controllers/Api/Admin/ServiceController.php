<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ServiceController extends Controller
{
    /**
     * Legacy enum values for the `category` column, kept for backward
     * compatibility with existing rows/consumers that still read the plain
     * string. New services are free to reuse any of these labels, but the
     * source of truth for filtering/display going forward is `category_id`.
     */
    private const LEGACY_CATEGORY_VALUES = [
        'vtu',
        'giftcard',
        'esim',
        'verification',
        'digital',
        'utility',
        'social',
        'email',
        'streaming',
    ];

    public function index()
    {
        return response()->json([
            'success' => true,
            'services' => Service::with('categoryGroup')->latest()->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'category_id' => 'nullable|exists:categories,id',
            'category' => ['nullable', Rule::in(self::LEGACY_CATEGORY_VALUES)],
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'currency' => 'nullable|string|size:3',
            'stock' => 'nullable|integer|min:0',
            'provider_id' => 'nullable|exists:providers,id',
            'active' => 'boolean',
        ]);

        $slug = Str::slug($data['name']);

        if (Service::where('slug', $slug)->exists()) {
            $slug .= '-' . time();
        }

        $data['slug'] = $slug;
        $data['active'] = $data['active'] ?? true;
        $data['currency'] = $data['currency'] ?? 'NGN';
        // Legacy enum column is NOT NULL; derive a value from the linked
        // category (or fall back to "digital") when the caller only sends
        // category_id.
        $data['category'] = $data['category'] ?? $this->legacyCategoryFor($data['category_id'] ?? null);

        $service = Service::create($data);

        return response()->json([
            'success' => true,
            'message' => 'Service created successfully.',
            'service' => $service->load('categoryGroup'),
        ], 201);
    }

    public function update(Request $request, Service $service)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'category_id' => 'nullable|exists:categories,id',
            'category' => ['sometimes', Rule::in(self::LEGACY_CATEGORY_VALUES)],
            'description' => 'nullable|string',
            'price' => 'sometimes|numeric|min:0',
            'currency' => 'nullable|string|size:3',
            'stock' => 'nullable|integer|min:0',
            'provider_id' => 'nullable|exists:providers,id',
            'active' => 'boolean',
        ]);

        if (isset($data['name'])) {
            $slug = Str::slug($data['name']);

            if (
                Service::where('slug', $slug)
                    ->where('id', '!=', $service->id)
                    ->exists()
            ) {
                $slug .= '-' . time();
            }

            $data['slug'] = $slug;
        }

        $service->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Service updated successfully.',
            'service' => $service->fresh()->load('categoryGroup'),
        ]);
    }

    public function destroy(Service $service)
    {
        $service->delete();

        return response()->json([
            'success' => true,
            'message' => 'Service deleted successfully.',
        ]);
    }

    private function legacyCategoryFor(?int $categoryId): string
    {
        if (! $categoryId) {
            return 'digital';
        }

        $slug = \App\Models\Category::find($categoryId)?->slug ?? '';

        foreach (self::LEGACY_CATEGORY_VALUES as $value) {
            if (str_contains($slug, $value)) {
                return $value;
            }
        }

        return 'digital';
    }
}
