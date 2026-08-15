<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Provider;
use App\Models\Service;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * SEO fix: GET /services, GET /categories and GET /virtual-numbers/providers
 * must be readable by anonymous visitors (Next.js's app/services and
 * app/virtual-numbers pages now render real content for logged-out
 * crawlers instead of relying on an auth-gated API that always 401s).
 * These are plain, unauthenticated DB reads — no wallet/cart/order/
 * third-party-provider action is exposed by any of them.
 */
class PublicCatalogueApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_anonymous_visitor_can_list_active_services(): void
    {
        Service::create([
            'name' => 'Public Data Plan',
            'slug' => 'public-data-plan-'.Str::random(6),
            'category' => 'vtu',
            'description' => 'Test service',
            'price' => 500,
            'currency' => 'NGN',
            'active' => true,
        ]);
        Service::create([
            'name' => 'Hidden Plan',
            'slug' => 'hidden-plan-'.Str::random(6),
            'category' => 'vtu',
            'description' => 'Test service',
            'price' => 500,
            'currency' => 'NGN',
            'active' => false,
        ]);

        $response = $this->getJson('/api/services');

        $response->assertOk()->assertJsonPath('success', true);

        $names = collect($response->json('services'))->pluck('name');
        $this->assertTrue($names->contains('Public Data Plan'));
        $this->assertFalse($names->contains('Hidden Plan'));
    }

    public function test_anonymous_visitor_can_list_active_categories(): void
    {
        Category::create(['name' => 'Data', 'slug' => 'data-'.Str::random(6), 'status' => true]);

        $response = $this->getJson('/api/categories');

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertNotEmpty($response->json('data'));
    }

    public function test_anonymous_visitor_can_list_active_virtual_number_providers(): void
    {
        Provider::create([
            'name' => '5SIM',
            'slug' => '5sim',
            'base_url' => '',
            'api_key' => 'mock:key',
            'active' => true,
        ]);

        $response = $this->getJson('/api/virtual-numbers/providers');

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertNotEmpty($response->json('data'));
    }

    public function test_anonymous_visitor_still_cannot_reach_authenticated_catalogue_actions(): void
    {
        // Cart/checkout/wallet/order actions remain behind auth:sanctum —
        // opening the catalogue reads must not have widened these.
        $this->getJson('/api/cart')->assertUnauthorized();
        $this->getJson('/api/wallet')->assertUnauthorized();
        $this->getJson('/api/orders')->assertUnauthorized();
        $this->getJson('/api/virtual-numbers/5sim/countries')->assertUnauthorized();
    }
}
