<?php

namespace Tests\Unit;

use App\Support\Utf8Text;
use Tests\TestCase;

class Utf8TextTest extends TestCase
{
    public function test_fix_mojibake_repairs_utf8_names_with_special_characters(): void
    {
        $this->assertSame('Santo Niño', Utf8Text::fixMojibake('Santo NiÃ±o'));
        $this->assertSame('PARAÑAQUE', Utf8Text::displayUpper('ParaÃ±aque'));
    }

    public function test_display_upper_preserves_valid_unicode_names(): void
    {
        $this->assertSame('SANTO NIÑO', Utf8Text::displayUpper('Santo Niño'));
        $this->assertSame('CITY OF PARAÑAQUE', Utf8Text::displayUpper('City of Parañaque'));
    }
}
