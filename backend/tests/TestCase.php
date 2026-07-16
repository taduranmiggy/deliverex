<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function apiAs(User $user): static
    {
        $token = $user->createToken('test')->plainTextToken;

        return $this->withHeader('Authorization', 'Bearer '.$token);
    }
}
