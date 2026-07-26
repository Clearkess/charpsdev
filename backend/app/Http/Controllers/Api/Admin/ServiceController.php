<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ServiceController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'services' => Service::latest()->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'category' => [
                'required',
                Rule::in([
                    'vtu',
                    'giftcard',
                    'esim',
                    'verification',
                    'digital',
                    'utility'
                ]),
            ],
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'active' => 'boolean',
        ]);

        $slug = Str::slug($data['name']);

        if (Service::where('slug', $slug)->exists()) {
            $slug .= '-' . time();
        }

        $data['slug'] = $slug;
        $data['active'] = $data['active'] ?? true;

        $service = Service::create($data);

        return response()->json([
            'success' => true,
            'message' => 'Service created successfully.',
            'service' => $service,
        ], 201);
    }

    public function update(Request $request, Service $service)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'category' => [
                'sometimes',
                Rule::in([
                    'vtu',
                    'giftcard',
                    'esim',
                    'verification',
                    'digital',
                    'utility'
                ]),
            ],
            'description' => 'nullable|string',
            'price' => 'sometimes|numeric|min:0',
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
            'service' => $service,
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
}
