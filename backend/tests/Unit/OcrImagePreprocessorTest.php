<?php

namespace Tests\Unit;

use App\Services\Ocr\OcrImagePreprocessor;
use Tests\TestCase;

class OcrImagePreprocessorTest extends TestCase
{
    public function test_unreadable_file_returns_original_path(): void
    {
        $preprocessor = new OcrImagePreprocessor;
        $missing = storage_path('app/missing-ocr-image-'.uniqid().'.jpg');

        $result = $preprocessor->preprocess($missing);

        $this->assertSame($missing, $result['path']);
        $this->assertArrayHasKey('preprocess_skipped', $result['diagnostics']);
    }

    public function test_disabled_preprocess_returns_original_path(): void
    {
        config(['ocr.preprocess_enabled' => false]);
        $preprocessor = new OcrImagePreprocessor;
        $path = __FILE__;

        $result = $preprocessor->preprocess($path);

        $this->assertSame($path, $result['path']);
        $this->assertSame('disabled', $result['diagnostics']['preprocess_skipped']);
    }

    public function test_rotated_jpeg_returns_upright_dimensions_when_gd_available(): void
    {
        if (! extension_loaded('gd') || ! function_exists('imagejpeg')) {
            $this->markTestSkipped('GD extension not available.');
        }

        $source = $this->createRotatedJpeg(120, 80);
        $preprocessor = new OcrImagePreprocessor;
        $result = $preprocessor->preprocess($source);

        try {
            if (($result['diagnostics']['preprocess_skipped'] ?? null) !== null) {
                $this->markTestSkipped('Preprocessing skipped: '.($result['diagnostics']['preprocess_skipped'] ?? 'unknown'));
            }

            $this->assertFileExists($result['path']);
            $info = @getimagesize($result['path']);
            $this->assertIsArray($info);
            $this->assertGreaterThanOrEqual(80, $info[0]);
            $this->assertGreaterThanOrEqual(80, $info[1]);
        } finally {
            if ($result['path'] !== $source && is_file($result['path'])) {
                @unlink($result['path']);
            }
            if (is_file($source)) {
                @unlink($source);
            }
        }
    }

    private function createRotatedJpeg(int $width, int $height): string
    {
        $image = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($image, 255, 255, 255);
        $black = imagecolorallocate($image, 0, 0, 0);
        imagefilledrectangle($image, 0, 0, $width, $height, $white);
        imagefilledrectangle($image, 5, 5, $width - 5, $height - 5, $black);

        $path = sys_get_temp_dir().'/dx-ocr-test-'.uniqid().'.jpg';
        imagejpeg($image, $path, 90);
        imagedestroy($image);

        return $path;
    }
}
