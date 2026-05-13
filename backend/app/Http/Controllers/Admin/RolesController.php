<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Role;

class RolesController extends Controller
{
    public function index()
    {
        return response()->json(Role::orderBy('name')->get(['id', 'name']));
    }
}
