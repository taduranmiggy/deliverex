<?php

namespace App\Support;

class Utf8Text
{
    public static function fixMojibake(string $text): string
    {
        $text = trim($text);
        if ($text === '') {
            return $text;
        }

        if (! preg_match('/Ã|Â|â|ï¿½/u', $text)) {
            return $text;
        }

        $bytes = '';
        $length = mb_strlen($text, 'UTF-8');
        for ($index = 0; $index < $length; $index++) {
            $character = mb_substr($text, $index, 1, 'UTF-8');
            $codePoint = mb_ord($character, 'UTF-8');
            if ($codePoint === false) {
                return $text;
            }
            $bytes .= chr($codePoint & 0xFF);
        }

        if (! mb_check_encoding($bytes, 'UTF-8')) {
            return $text;
        }

        return $bytes;
    }

    public static function displayUpper(string $text): string
    {
        return mb_strtoupper(self::fixMojibake($text), 'UTF-8');
    }
}
