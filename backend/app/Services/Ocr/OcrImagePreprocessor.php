<?php

namespace App\Services\Ocr;

use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Safe GD-based image preprocessing before OCR. Original file is never modified.
 */
class OcrImagePreprocessor
{
  private const MIN_SHORT_EDGE = 800;

  private const MAX_LONG_EDGE = 4000;

  /**
   * @return array{path:string, diagnostics:array<string,mixed>}
   */
  public function preprocess(string $sourcePath): array
  {
    if (! config('ocr.preprocess_enabled', true)) {
      return [
        'path' => $sourcePath,
        'diagnostics' => ['preprocess_skipped' => 'disabled'],
      ];
    }

    if (! extension_loaded('gd')) {
      return [
        'path' => $sourcePath,
        'diagnostics' => ['preprocess_skipped' => 'gd_unavailable'],
      ];
    }

    if (! is_file($sourcePath) || ! is_readable($sourcePath)) {
      return [
        'path' => $sourcePath,
        'diagnostics' => ['preprocess_skipped' => 'unreadable_source'],
      ];
    }

    $steps = [];
    $tempPath = null;

    try {
      $workingPath = $this->applyExifRotation($sourcePath, $steps);
      $image = $this->loadImage($workingPath);
      if ($image === null) {
        return [
          'path' => $sourcePath,
          'diagnostics' => ['preprocess_skipped' => 'decode_failed'],
        ];
      }

      $image = $this->normalizeResolution($image, $steps);
      $image = $this->cropBorders($image, $steps);
      $image = $this->adjustContrastBrightness($image, $steps);
      $image = $this->reduceNoise($image, $steps);
      $image = $this->deskew($image, $steps);

      $tempPath = $this->writeTempImage($image, $sourcePath);
      imagedestroy($image);

      if ($workingPath !== $sourcePath && is_file($workingPath)) {
        @unlink($workingPath);
      }

      if ($tempPath === null) {
        return [
          'path' => $sourcePath,
          'diagnostics' => ['preprocess_skipped' => 'write_failed'],
        ];
      }

      return [
        'path' => $tempPath,
        'diagnostics' => [
          'preprocessed' => true,
          'preprocess_steps' => $steps,
          'preprocessed_path' => $tempPath,
        ],
      ];
    } catch (Throwable $e) {
      if ($tempPath && is_file($tempPath)) {
        @unlink($tempPath);
      }

      Log::warning('OCR image preprocessing failed; using original.', [
        'path' => $sourcePath,
        'error' => $e->getMessage(),
      ]);

      return [
        'path' => $sourcePath,
        'diagnostics' => [
          'preprocess_skipped' => 'exception',
          'preprocess_error' => $e->getMessage(),
        ],
      ];
    }
  }

  /**
   * @param  list<string>  $steps
   */
  private function applyExifRotation(string $sourcePath, array &$steps): string
  {
    if (! function_exists('exif_read_data')) {
      return $sourcePath;
    }

    $ext = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));
    if (! in_array($ext, ['jpg', 'jpeg', 'tif', 'tiff'], true)) {
      return $sourcePath;
    }

    $exif = @exif_read_data($sourcePath);
    if (! is_array($exif) || ! isset($exif['Orientation'])) {
      return $sourcePath;
    }

    $orientation = (int) $exif['Orientation'];
    $image = $this->loadImage($sourcePath);
    if ($image === null) {
      return $sourcePath;
    }

    $rotated = match ($orientation) {
      3 => imagerotate($image, 180, 0),
      6 => imagerotate($image, -90, 0),
      8 => imagerotate($image, 90, 0),
      default => $image,
    };

    if ($rotated === false) {
      imagedestroy($image);

      return $sourcePath;
    }

    if ($rotated !== $image) {
      imagedestroy($image);
    }

    $temp = $this->writeTempImage($rotated, $sourcePath);
    imagedestroy($rotated);

    if ($temp === null) {
      return $sourcePath;
    }

    $steps[] = 'exif_rotation';

    return $temp;
  }

  /**
   * @param  list<string>  $steps
   */
  private function normalizeResolution(\GdImage $image, array &$steps): \GdImage
  {
    $width = imagesx($image);
    $height = imagesy($image);
    $short = min($width, $height);
    $long = max($width, $height);

    $scale = 1.0;
    if ($short < self::MIN_SHORT_EDGE) {
      $scale = self::MIN_SHORT_EDGE / $short;
    }
    if ($long * $scale > self::MAX_LONG_EDGE) {
      $scale = self::MAX_LONG_EDGE / $long;
    }

    if (abs($scale - 1.0) < 0.02) {
      return $image;
    }

    $newW = max(1, (int) round($width * $scale));
    $newH = max(1, (int) round($height * $scale));
    $resized = imagecreatetruecolor($newW, $newH);
    if ($resized === false) {
      return $image;
    }

    imagecopyresampled($resized, $image, 0, 0, 0, 0, $newW, $newH, $width, $height);
    imagedestroy($image);
    $steps[] = 'resolution_normalize';

    return $resized;
  }

  /**
   * @param  list<string>  $steps
   */
  private function cropBorders(\GdImage $image, array &$steps): \GdImage
  {
    $width = imagesx($image);
    $height = imagesy($image);
    if ($width < 40 || $height < 40) {
      return $image;
    }

    $threshold = 245;
    $top = 0;
    $bottom = $height - 1;
    $left = 0;
    $right = $width - 1;

    for ($y = 0; $y < $height; $y++) {
      if ($this->rowIsMostlyWhite($image, $y, $width, $threshold)) {
        $top = $y + 1;
      } else {
        break;
      }
    }

    for ($y = $height - 1; $y >= $top; $y--) {
      if ($this->rowIsMostlyWhite($image, $y, $width, $threshold)) {
        $bottom = $y - 1;
      } else {
        break;
      }
    }

    for ($x = 0; $x < $width; $x++) {
      if ($this->colIsMostlyWhite($image, $x, $top, $bottom, $threshold)) {
        $left = $x + 1;
      } else {
        break;
      }
    }

    for ($x = $width - 1; $x >= $left; $x--) {
      if ($this->colIsMostlyWhite($image, $x, $top, $bottom, $threshold)) {
        $right = $x - 1;
      } else {
        break;
      }
    }

    $cropW = $right - $left + 1;
    $cropH = $bottom - $top + 1;
    if ($cropW < 20 || $cropH < 20) {
      return $image;
    }

    if ($cropW * $cropH < ($width * $height * 0.6)) {
      return $image;
    }

    $cropped = imagecrop($image, ['x' => $left, 'y' => $top, 'width' => $cropW, 'height' => $cropH]);
    if ($cropped === false) {
      return $image;
    }

    imagedestroy($image);
    $steps[] = 'border_crop';

    return $cropped;
  }

  /**
   * @param  list<string>  $steps
   */
  private function adjustContrastBrightness(\GdImage $image, array &$steps): \GdImage
  {
    if (@imagefilter($image, IMG_FILTER_CONTRAST, -8) === false) {
      return $image;
    }
    @imagefilter($image, IMG_FILTER_BRIGHTNESS, 4);
    $steps[] = 'contrast_brightness';

    return $image;
  }

  /**
   * @param  list<string>  $steps
   */
  private function reduceNoise(\GdImage $image, array &$steps): \GdImage
  {
    $matrix = [
      [1, 1, 1],
      [1, 2, 1],
      [1, 1, 1],
    ];
    if (@imageconvolution($image, $matrix, 10, 0) === false) {
      return $image;
    }

    $steps[] = 'noise_reduction';

    return $image;
  }

  /**
   * @param  list<string>  $steps
   */
  private function deskew(\GdImage $image, array &$steps): \GdImage
  {
    $width = imagesx($image);
    $height = imagesy($image);
    if ($width < 60 || $height < 60) {
      return $image;
    }

    $gray = imagecreatetruecolor($width, $height);
    if ($gray === false) {
      return $image;
    }

    imagecopy($gray, $image, 0, 0, 0, 0, $width, $height);
    imagefilter($gray, IMG_FILTER_GRAYSCALE);
    imagefilter($gray, IMG_FILTER_CONTRAST, -20);

    $bestAngle = 0.0;
    $bestScore = 0;

    foreach (range(-3, 3) as $tenths) {
      $angle = $tenths * 0.5;
      $rotated = imagerotate($gray, $angle, 0);
      if ($rotated === false) {
        continue;
      }

      $score = $this->horizontalProjectionScore($rotated);
      imagedestroy($rotated);

      if ($score > $bestScore) {
        $bestScore = $score;
        $bestAngle = $angle;
      }
    }

    imagedestroy($gray);

    if (abs($bestAngle) < 0.3) {
      return $image;
    }

    $deskewed = imagerotate($image, $bestAngle, 0);
    if ($deskewed === false) {
      return $image;
    }

    imagedestroy($image);
    $steps[] = 'deskew';

    return $deskewed;
  }

  private function horizontalProjectionScore(\GdImage $image): int
  {
    $width = imagesx($image);
    $height = imagesy($image);
    $score = 0;

    for ($y = 0; $y < $height; $y++) {
      $dark = 0;
      for ($x = 0; $x < $width; $x += 4) {
        $rgb = imagecolorat($image, $x, $y);
        $r = ($rgb >> 16) & 0xFF;
        if ($r < 200) {
          $dark++;
        }
      }
      if ($dark > ($width / 8)) {
        $score += $dark;
      }
    }

    return $score;
  }

  private function rowIsMostlyWhite(\GdImage $image, int $y, int $width, int $threshold): bool
  {
    $white = 0;
    $samples = max(1, (int) ($width / 8));
    for ($i = 0; $i < $samples; $i++) {
      $x = (int) round(($i / max(1, $samples - 1)) * ($width - 1));
      $rgb = imagecolorat($image, $x, $y);
      $r = ($rgb >> 16) & 0xFF;
      $g = ($rgb >> 8) & 0xFF;
      $b = $rgb & 0xFF;
      if ($r >= $threshold && $g >= $threshold && $b >= $threshold) {
        $white++;
      }
    }

    return $white >= ($samples * 0.85);
  }

  private function colIsMostlyWhite(\GdImage $image, int $x, int $top, int $bottom, int $threshold): bool
  {
    $white = 0;
    $span = $bottom - $top + 1;
    $samples = max(1, (int) ($span / 8));
    for ($i = 0; $i < $samples; $i++) {
      $y = $top + (int) round(($i / max(1, $samples - 1)) * ($span - 1));
      $rgb = imagecolorat($image, $x, $y);
      $r = ($rgb >> 16) & 0xFF;
      $g = ($rgb >> 8) & 0xFF;
      $b = $rgb & 0xFF;
      if ($r >= $threshold && $g >= $threshold && $b >= $threshold) {
        $white++;
      }
    }

    return $white >= ($samples * 0.85);
  }

  private function loadImage(string $path): ?\GdImage
  {
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

    return match ($ext) {
      'jpg', 'jpeg' => @imagecreatefromjpeg($path) ?: null,
      'png' => @imagecreatefrompng($path) ?: null,
      'gif' => @imagecreatefromgif($path) ?: null,
      'webp' => function_exists('imagecreatefromwebp') ? (@imagecreatefromwebp($path) ?: null) : null,
      'bmp' => function_exists('imagecreatefrombmp') ? (@imagecreatefrombmp($path) ?: null) : null,
      default => null,
    };
  }

  private function writeTempImage(\GdImage $image, string $sourcePath): ?string
  {
    $ext = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));
    $suffix = in_array($ext, ['jpg', 'jpeg', 'png'], true) ? $ext : 'jpg';
    $temp = tempnam(sys_get_temp_dir(), 'dx-ocr-');
    if ($temp === false) {
      return null;
    }

    $target = $temp.'.'.$suffix;
    @unlink($temp);

    $ok = match ($suffix) {
      'png' => imagepng($image, $target, 6),
      default => imagejpeg($image, $target, 92),
    };

    return $ok ? $target : null;
  }
}
