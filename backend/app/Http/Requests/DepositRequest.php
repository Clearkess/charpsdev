<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DepositRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Phase 2 (Wallet Refinements): cap a single deposit at
            // 5,000,000 NGN. This was previously unbounded above the
            // 100 NGN floor, which is an unnecessary risk for a Paystack
            // charge triggered directly from user input (fat-fingered
            // amount, or a client bypassing the frontend's own <input>
            // constraints and hitting the API directly).
            'amount' => ['required', 'numeric', 'min:100', 'max:5000000'],
        ];
    }
}
