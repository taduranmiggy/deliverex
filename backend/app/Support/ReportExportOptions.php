<?php

namespace App\Support;

use Illuminate\Http\Request;

class ReportExportOptions
{
    /** @return array<string, bool> */
    public static function fromRequest(Request $request): array
    {
        $defaults = [
            'include_logo' => true,
            'include_page_numbers' => true,
            'include_generated_by' => true,
            'include_timestamp' => true,
            'include_filters_summary' => true,
            'include_company' => true,
            'include_signature' => false,
            'include_watermark' => false,
        ];

        $resolved = [];
        foreach ($defaults as $key => $default) {
            $resolved[$key] = $request->has($key)
                ? filter_var($request->query($key), FILTER_VALIDATE_BOOLEAN)
                : $default;
        }

        return $resolved;
    }
}
