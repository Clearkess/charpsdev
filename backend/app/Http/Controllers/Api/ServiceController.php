<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Service;

class ServiceController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'services' => Service::query()
                ->where('active', true)
                ->latest()
                ->get(),
        ]);
    }
}
