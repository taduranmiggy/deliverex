<?php

namespace App\Http\Controllers;

class SpaController extends Controller
{
    public function __invoke()
    {
        $spa = public_path('index.html');
        if (file_exists($spa)) {
            return response()->file($spa);
        }

        return view('welcome');
    }
}
