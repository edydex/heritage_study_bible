import collections
import copy
import importlib.util
import itertools
import json
import unittest
from functools import lru_cache
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('kjv_links', Path(__file__).with_name('build-kjv-links.py'))
links = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(links)


class MandatoryWitnessAlignment(unittest.TestCase):
    def test_every_short_repeated_sequence_agrees_with_all_optimal_alignments(self):
        def expected(a, b):
            @lru_cache(None)
            def solve(i, j):
                if i == len(a) or j == len(b):
                    return frozenset([()])
                candidates = set(solve(i + 1, j)) | set(solve(i, j + 1))
                if a[i] == b[j]:
                    candidates.update(((i, j),) + rest for rest in solve(i + 1, j + 1))
                longest = max(map(len, candidates))
                return frozenset(item for item in candidates if len(item) == longest)
            possibilities = solve(0, 0)
            return set.intersection(*(set(item) for item in possibilities))
        sequences = [tokens for length in range(4) for tokens in itertools.product('ab', repeat=length)]
        for a in sequences:
            for b in sequences:
                self.assertEqual(set(links.mandatory_pairs(a, b, lambda x, y: x == y).items()), expected(a, b), (a, b))

    def test_equal_strongs_cannot_override_a_different_inflected_form(self):
        a = [(links.greek_form('ἀπαγάγετε'), {'520'})]
        b = [(links.greek_form('ἀπάγετε'), {'520'})]
        self.assertEqual(links.mandatory_pairs(a, b, lambda x, y: x[0] == y[0] and bool(x[1] & y[1])), {})

    def test_same_unaccented_form_cannot_override_a_different_strongs_identity(self):
        a = [(links.greek_form('ἐν'), {'1722'})]
        b = [(links.greek_form('ἕν'), {'1520'})]
        self.assertEqual(a[0][0], b[0][0])
        self.assertEqual(links.mandatory_pairs(a, b, lambda x, y: x[0] == y[0] and bool(x[1] & y[1])), {})

    def test_iota_subscript_is_removed_before_casefold(self):
        self.assertEqual(links.greek_form('ἀρχῇ'), links.greek_form('αρχη'))
        self.assertEqual(links.greek_form('Χριστῷ'), links.greek_form('χριστω'))
        self.assertEqual(links.greek_form('Λόγος'), links.greek_form('λογος'))


class PublisherVerseContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture = links.read(links.ROOT / 'tests/fixtures/kjv-osis-word-links.json')
        cls.greek = links.corpus_verses(links.read(links.DATA / 'greek-nt-n1904.json'))
        cls.target = links.corpus_verses(links.read(links.ROOT / 'public/data/translations/KJV.json'))
        cls.concordance = links.read(links.DATA / 'greek-concordance.json')
        cls.words = {book['name']: book['verses'] for book in cls.concordance['books']}

    def aligned(self, reference):
        code, chapter, verse = reference.split('.')
        name, ref = links.OSIS_BOOKS[code], f'{chapter}:{verse}'
        record = copy.deepcopy(self.fixture['records'][reference])
        source, target = self.greek[name][ref], self.target[name][ref]
        groups, reason = links.align_verse(record, source, target, self.words[name][ref], self.concordance['lemmas'], collections.Counter())
        return source, target, groups, reason

    def test_repeated_word_and_god_phrases_keep_their_actual_context(self):
        source, target, groups, _ = self.aligned('John.1.1')
        words = [g for g in groups if any(target[s:e] == 'the Word' for s, e in g['targetRanges'])]
        gods = [g for g in groups if any(target[s:e] == 'God' for s, e in g['targetRanges'])]
        self.assertEqual(len(words), 3)
        self.assertEqual(len(gods), 2)
        self.assertEqual([source[slice(*g['source'])].strip(',.') for g in gods], ['τὸν Θεόν', 'Θεὸς'])
        self.assertTrue(any('beginning' in target[s:e] for g in groups for s, e in g['targetRanges']))

    def test_cross_verse_publisher_positions_do_not_link_to_the_wrong_verse(self):
        _, target, groups, _ = self.aligned('Rom.1.3')
        jesus = target.index('Jesus')
        self.assertFalse(any(s <= jesus < e for g in groups for s, e in g['targetRanges']))
        self.assertTrue(groups)

    def test_different_book_tree_reading_is_not_colored_by_shared_strongs_or_proximity(self):
        source, target, groups, _ = self.aligned('Rev.22.19')
        book = target.index('book of life')
        tree = source.index('ξύλου')
        self.assertFalse(any(s <= book < e for g in groups for s, e in g['targetRanges']))
        self.assertFalse(any(g['source'][0] <= tree < g['source'][1] for g in groups))
        self.assertTrue(groups)

    def test_form_variant_split_verb_is_omitted_even_when_strongs_agrees(self):
        _, target, groups, _ = self.aligned('Mark.14.44')
        lead, away = target.index('lead'), target.index('away')
        self.assertFalse(any(s <= lead < e or s <= away < e for g in groups for s, e in g['targetRanges']))

    def test_publisher_split_verb_keeps_both_segments_without_claiming_the_intervening_pronoun(self):
        source, target, groups, _ = self.aligned('Matt.1.19')
        verb = next(group for group in groups if 'ἀπολῦσαι' in source[slice(*group['source'])])
        self.assertEqual([target[s:e] for s, e in verb['targetRanges']], ['to put', 'away'])
        pronoun = target.index('her away')
        self.assertFalse(any(s <= pronoun < e for s, e in verb['targetRanges']))

    def test_minor_english_printing_difference_preserves_other_attested_phrases(self):
        _, target, groups, _ = self.aligned('Acts.1.8')
        self.assertIn('Judæa', target)
        self.assertTrue(any(target[s:e] == 'power' for g in groups for s, e in g['targetRanges']))

    def test_repaired_romans_verse_does_not_assign_its_tr_only_tail_to_n1904(self):
        _, target, groups, _ = self.aligned('Rom.8.1')
        tail = target.index('who walk')
        self.assertTrue(groups)
        self.assertTrue(all(e <= tail for g in groups for s, e in g['targetRanges']))

    def test_single_position_compound_keeps_all_component_strongs(self):
        _, _, groups, reason = self.aligned('Heb.6.3')
        self.assertTrue(groups)
        source, target, groups, _ = self.aligned('Heb.6.3')
        compound = next(group for group in groups if 'ἐάνπερ' in source[slice(*group['source'])])
        self.assertEqual(target[slice(*compound['target'])], 'if')

    def test_inconsistent_strong_array_skips_its_phrase_without_discarding_verified_neighbors(self):
        _, target, groups, _ = self.aligned('2Cor.8.10')
        self.assertTrue(groups)
        herein = target.index('herein')
        self.assertFalse(any(a <= herein < b for group in groups for a, b in group['targetRanges']))
        self.assertTrue(any('advice' in target[a:b] for group in groups for a, b in group['targetRanges']))


if __name__ == '__main__':
    unittest.main()
