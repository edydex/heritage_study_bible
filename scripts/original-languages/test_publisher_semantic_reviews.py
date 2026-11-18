"""Regression checks for explicit corrections, not a semantic certification of the NT.

The fixture is a small set of manually adjudicated Greek occurrences. In addition
to compiler checks, every target word must be accounted for exactly once; shared
pronoun spelling is never sufficient to substitute a different occurrence.
"""
import importlib.util
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('reviews', Path(__file__).with_name('compile-reviewed-links.py'))
reviews = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(reviews)


class PublisherSemanticReviews(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = reviews.read(ROOT / 'tests/fixtures/publisher-semantic-reviews.json')
        cls.greek = reviews.corpus(reviews.read(ROOT / 'public/data/original-languages/greek-nt-n1904.json'))
        cls.targets = {target: reviews.corpus(reviews.read(ROOT / f'public/data/translations/{target}.json')) for target in ('BSB', 'KJV')}

    def entries(self):
        for case in self.fixture['cases']:
            path = ROOT / f"scripts/original-languages/reviewed-{case['target'].lower()}" / case['file']
            resource = reviews.read(path)
            yield case, resource['book'], resource['verses'][case['reference']]

    def test_full_review_texts_and_accounting_are_exact(self):
        for case, book, entry in self.entries():
            with self.subTest(target=case['target'], book=book, reference=case['reference']):
                reference = dict(zip(('chapter', 'verse'), map(int, case['reference'].split(':'))))
                compiled = reviews.compile_verse(entry, self.greek[book][case['reference']], self.targets[case['target']][book][case['reference']], source_verses=self.greek[book], reference=reference)
                self.assertTrue(compiled['review']['completeAccounting'])
                selectors = [p for group in entry['groups'] for p in group['targetPhrases']] + entry.get('unmappedTarget', [])
                spans = [reviews.phrase_range(entry['targetText'], p) for p in selectors]
                for word in re.finditer(r"[^\W_]+(?:['’][^\W_]+)*", entry['targetText']):
                    self.assertEqual(sum(a <= word.start() and b >= word.end() for a, b in spans), 1, word[0])

    def test_pronoun_occurrences_and_semantic_phrases_keep_their_actual_heads(self):
        for case, _, entry in self.entries():
            with self.subTest(target=case['target'], reference=case['reference']):
                for expected in case.get('groups', []):
                    matches = [group for group in entry['groups'] if group['sourceTokens'] == expected['sourceTokens']]
                    self.assertEqual(len(matches), 1, expected)
                    actual_ranges = [reviews.phrase_range(entry['targetText'], p) for p in matches[0]['targetPhrases']]
                    self.assertEqual(actual_ranges, [reviews.phrase_range(entry['targetText'], p) for p in expected['phrases']])

    def test_accepted_corrections_are_present_in_the_installed_mapping(self):
        for case, book, entry in self.entries():
            with self.subTest(target=case['target'], book=book, reference=case['reference']):
                reference = dict(zip(('chapter', 'verse'), map(int, case['reference'].split(':'))))
                compiled = reviews.compile_verse(entry, self.greek[book][case['reference']], self.targets[case['target']][book][case['reference']], source_verses=self.greek[book], reference=reference)
                canonical = reviews.read(ROOT / f"public/data/original-languages/{case['target'].lower()}-word-links/{book.lower().replace(' ', '-')}.json")['verses'][case['reference']]
                self.assertEqual(canonical['groups'], compiled['groups'])
                self.assertEqual(canonical['review']['sourceNotes'], compiled['review']['sourceNotes'])
                self.assertEqual(canonical['review']['targetNotes'], compiled['review']['targetNotes'])

    def test_actual_source_witness_differences_are_explained_instead_of_crossed(self):
        for case, _, entry in self.entries():
            with self.subTest(target=case['target'], reference=case['reference']):
                for index in case.get('unpairedSource', []):
                    note = next(note for note in entry['unmappedSource'] if index in note['tokens'])
                    self.assertIn('Source-witness difference', note['reason'])
                    self.assertFalse(any(index in group['sourceTokens'] for group in entry['groups']))
                for phrase in case.get('unpairedTarget', []):
                    span = reviews.phrase_range(entry['targetText'], phrase)
                    matches = [note for note in entry['unmappedTarget'] if reviews.phrase_range(entry['targetText'], note) == span]
                    self.assertEqual(len(matches), 1)
                    self.assertTrue(matches[0]['reason'].strip())

    def test_normalized_preposition_is_not_inherited_as_publisher_numeral(self):
        for case, _, entry in self.entries():
            for identity in case.get('sourceIdentity', []):
                with self.subTest(reference=case['reference'], index=identity['index']):
                    self.assertEqual(entry['sourceText'].split()[identity['index']].strip(',.·;·'), identity['text'])
                    self.assertNotEqual(identity['strongs'], identity['publisherStrongs'])
                    group = next(group for group in entry['groups'] if identity['index'] in group['sourceTokens'])
                    self.assertGreater(len(group['sourceTokens']), 1)
                    self.assertTrue(any('fold' in p['text'] for p in group['targetPhrases']))
                    self.assertFalse(any(p['text'] in ('a', 'another') for p in group['targetPhrases']))

    def test_metadata_errata_preserve_exact_displayed_tokens_and_originals(self):
        errata = reviews.read(Path(__file__).with_name('greek-nt-metadata-errata.json'))
        self.assertEqual(errata['sourceSha256'], self.fixture['sourceSha256'])
        self.assertEqual(len(errata['corrections']), 3)
        expected = {('John', 11, 32, 11): ('847', '846', 'P-GSM'), ('Acts', 20, 13, 9): ('788', '789', 'N-ASF'), ('Acts', 20, 14, 6): ('788', '789', 'N-ASF')}
        for correction in errata['corrections']:
            ref = correction['reference']
            key = (ref['book'], ref['chapter'], ref['verse'], correction['tokenIndex'])
            old, new, morphology = expected[key]
            self.assertEqual(correction['original']['strongs'], old)
            self.assertEqual(correction['corrected']['strongs'], new)
            self.assertEqual(correction['corrected']['func_morph'], morphology)
            self.assertEqual(self.greek[ref['book']][f"{ref['chapter']}:{ref['verse']}"].split()[correction['tokenIndex']], correction['text'])
            self.assertGreaterEqual(len(correction['evidence']), 2)


if __name__ == '__main__':
    unittest.main()
