<?php

namespace App\Services\Ocr;

use Google\Cloud\DocumentAI\V1\Document;
use Google\Cloud\DocumentAI\V1\Document\Page;
use Google\Cloud\DocumentAI\V1\Document\Page\Table;
use Google\Cloud\DocumentAI\V1\Document\Page\Table\TableRow;
use Google\Cloud\DocumentAI\V1\Document\TextAnchor;

class DocumentAiStructuredExtractor
{
    /**
     * @return array{
     *   structured_hints:array<string,mixed>,
     *   provider_signals:array<string,mixed>,
     *   diagnostics:array<string,mixed>
     * }
     */
    public function extract(Document $document, ?float $entityConfidenceAvg = null): array
    {
        $documentText = (string) $document->getText();
        $entities = $this->extractEntities($document);
        $tableLines = $this->extractTableLines($document, $documentText);
        $neighborPairs = $this->extractNeighborLabelPairs($document, $documentText);
        $tablesCount = $this->countTables($document);
        $pagesCount = count($document->getPages());

        $structuredHints = [
            'entities' => $entities,
            'table_lines' => $tableLines,
            'neighbor_pairs' => $neighborPairs,
            'entity_mentions' => array_values(array_filter(array_map(
                static fn (array $e) => trim((string) ($e['mention_text'] ?? '')),
                $entities
            ))),
        ];

        $providerSignals = [
            'entity_confidence_avg' => $entityConfidenceAvg,
            'entities_count' => count($entities),
            'tables_count' => $tablesCount,
            'pages_count' => $pagesCount,
        ];

        return [
            'structured_hints' => $structuredHints,
            'provider_signals' => $providerSignals,
            'diagnostics' => [
                'structured_hints_count' => count($entities) + count($tableLines) + count($neighborPairs),
                'tables_count' => $tablesCount,
                'neighbor_pairs_count' => count($neighborPairs),
            ],
        ];
    }

    /**
     * @return list<array{type:string,mention_text:string,confidence:?float,normalized_value:?string}>
     */
    private function extractEntities(Document $document): array
    {
        $out = [];
        foreach ($document->getEntities() as $entity) {
            $normalized = null;
            if (method_exists($entity, 'getNormalizedValue') && $entity->getNormalizedValue() !== null) {
                $nv = $entity->getNormalizedValue();
                if (method_exists($nv, 'getText')) {
                    $normalized = trim((string) $nv->getText());
                }
            }

            $out[] = [
                'type' => strtolower(trim((string) $entity->getType())),
                'mention_text' => trim((string) $entity->getMentionText()),
                'confidence' => is_numeric($entity->getConfidence()) ? (float) $entity->getConfidence() : null,
                'normalized_value' => $normalized !== '' ? $normalized : null,
            ];
        }

        return $out;
    }

    /**
     * @return list<string>
     */
    private function extractTableLines(Document $document, string $documentText): array
    {
        $lines = [];
        foreach ($document->getPages() as $page) {
            if (! $page instanceof Page) {
                continue;
            }

            foreach ($page->getTables() as $table) {
                if (! $table instanceof Table) {
                    continue;
                }

                foreach ($table->getHeaderRows() as $row) {
                    $line = $this->flattenTableRow($row, $documentText);
                    if ($line !== '') {
                        $lines[] = $line;
                    }
                }

                foreach ($table->getBodyRows() as $row) {
                    $line = $this->flattenTableRow($row, $documentText);
                    if ($line !== '') {
                        $lines[] = $line;
                    }
                }
            }
        }

        return array_values(array_unique($lines));
    }

    private function flattenTableRow(mixed $row, string $documentText): string
    {
        if (! $row instanceof TableRow) {
            return '';
        }

        $cells = [];
        foreach ($row->getCells() as $cell) {
            $text = '';
            if (method_exists($cell, 'getLayout') && $cell->getLayout() !== null) {
                $text = $this->layoutText($cell->getLayout(), $documentText);
            }
            if ($text !== '') {
                $cells[] = $text;
            }
        }

        return trim(implode(' ', $cells));
    }

    /**
     * @return list<array{label:string,value:string}>
     */
    private function extractNeighborLabelPairs(Document $document, string $documentText): array
    {
        $pairs = [];

        foreach ($document->getPages() as $page) {
            if (! $page instanceof Page) {
                continue;
            }

            foreach ($page->getFormFields() as $field) {
                $label = $this->layoutText($field->getFieldName(), $documentText);
                $value = $this->layoutText($field->getFieldValue(), $documentText);
                if ($label !== '' && $value !== '') {
                    $pairs[] = ['label' => $label, 'value' => $value];
                }
            }

            $lineTexts = [];
            foreach ($page->getLines() as $line) {
                $text = $this->layoutText($line->getLayout(), $documentText);
                if ($text !== '') {
                    $lineTexts[] = $text;
                }
            }

            for ($i = 0; $i < count($lineTexts) - 1; $i++) {
                if (preg_match('/^(supplier|vendor|date|total|invoice|receipt|dr|length|width|height|volume)\b/i', $lineTexts[$i])) {
                    $pairs[] = [
                        'label' => $lineTexts[$i],
                        'value' => $lineTexts[$i + 1],
                    ];
                }
            }
        }

        return $pairs;
    }

    private function layoutText(mixed $layout, string $documentText): string
    {
        if ($layout === null || ! method_exists($layout, 'getTextAnchor')) {
            return '';
        }

        $anchor = $layout->getTextAnchor();
        if (! $anchor instanceof TextAnchor) {
            return '';
        }

        $content = trim((string) $anchor->getContent());
        if ($content !== '') {
            return $content;
        }

        return $this->textFromAnchor($anchor, $documentText);
    }

    private function textFromAnchor(TextAnchor $anchor, string $documentText): string
    {
        $parts = [];
        foreach ($anchor->getTextSegments() as $segment) {
            $start = (int) $segment->getStartIndex();
            $end = (int) $segment->getEndIndex();
            if ($end > $start && $documentText !== '') {
                $parts[] = substr($documentText, $start, $end - $start);
            }
        }

        return trim(implode('', $parts));
    }

    private function countTables(Document $document): int
    {
        $count = 0;
        foreach ($document->getPages() as $page) {
            if ($page instanceof Page) {
                $count += count($page->getTables());
            }
        }

        return $count;
    }
}
