<?php

namespace App\Http\Controllers;

use App\Services\Address\PsgcClient;
use Illuminate\Http\JsonResponse;
use Throwable;

class PsgcController extends Controller
{
    public function __construct(private PsgcClient $psgc)
    {
    }

    public function regions(): JsonResponse
    {
        return $this->respond(fn () => $this->psgc->regions());
    }

    public function provinces(string $region): JsonResponse
    {
        return $this->respond(fn () => $this->psgc->provinces($region));
    }

    public function regionalCities(string $region): JsonResponse
    {
        return $this->respond(fn () => $this->psgc->citiesMunicipalities($region));
    }

    public function provincialCities(string $region, string $province): JsonResponse
    {
        return $this->respond(fn () => $this->psgc->citiesMunicipalities($region, $province));
    }

    public function regionalBarangays(string $region, string $city): JsonResponse
    {
        return $this->respond(fn () => $this->psgc->barangays($region, null, $city));
    }

    public function provincialBarangays(string $region, string $province, string $city): JsonResponse
    {
        return $this->respond(fn () => $this->psgc->barangays($region, $province, $city));
    }

    private function respond(callable $callback): JsonResponse
    {
        try {
            return response()->json(['data' => $callback()]);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'message' => 'The PSGC geographic directory is temporarily unavailable. Please try again shortly.',
            ], 503);
        }
    }
}
