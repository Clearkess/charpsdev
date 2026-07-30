<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => Category::withCount('services')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'icon' => 'nullable|string|max:100',
            'status' => 'boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $slug = Str::slug($data['name']);
        if (Category::where('slug', $slug)->exists()) {
            $slug .= '-' . time();
        }

        $data['slug'] = $slug;
        $data['status'] = $data['status'] ?? true;
        $data['sort_order'] = $data['sort_order'] ?? 0;

        $category = Category::create($data);

        return response()->json([
            'success' => true,
            'message' => 'Category created successfully.',
            'data' => $category,
        ], 201);
    }

    public function update(Request $request, Category $category)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'icon' => 'nullable|string|max:100',
            'status' => 'boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        if (isset($data['name'])) {
            $slug = Str::slug($data['name']);
            if (Category::where('slug', $slug)->where('id', '!=', $category->id)->exists()) {
                $slug .= '-' . time();
            }
            $data['slug'] = $slug;
        }

        $category->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Category updated successfully.',
            'data' => $category,
        ]);
    }

    public function destroy(Category $category)
    {
        if ($category->services()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete a category that still has services. Reassign or delete its services first.',
            ], 422);
        }

        $category->delete();

        return response()->json([
            'success' => true,
            'message' => 'Category deleted successfully.',
        ]);
    }
}
