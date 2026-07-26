<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(['vtu', 'giftcard', 'esim', 'verification', 'digital', 'utility'])],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
