"""Guard exact spellings and ambiguity-safe publisher row transfers."""
import unittest
import itertools
from functools import lru_cache
from generateOriginalLanguages import greek_word, mandatory_exact_pairs


class GreekSpellingTests(unittest.TestCase):
    def test_reviewed_spellings_match_with_accents_and_punctuation(self):
        for source, publisher in [('Δαυεὶδ,', 'Δαυὶδ'), ('συνπαρακληθῆναι', 'συμπαρακληθῆναι')]:
            self.assertEqual(greek_word(source), greek_word(publisher))

    def test_other_words_and_inflections_still_differ(self):
        for source, publisher in [('ἀγάπην', 'ἀγάπῃ'), ('συνπαρακαλῶ', 'συμπαρακαλῶ'), ('Δαυεὶδ', 'Ἰωσὴφ')]:
            self.assertNotEqual(greek_word(source), greek_word(publisher))

    def test_changed_order_or_added_words_still_differ(self):
        normalize = lambda text: [greek_word(word) for word in text.split()]
        source = normalize('σπέρματος Δαυεὶδ')
        self.assertEqual(source, normalize('σπέρματος Δαυὶδ'))
        self.assertNotEqual(source, normalize('Δαυὶδ σπέρματος'))
        self.assertNotEqual(source, normalize('τοῦ σπέρματος Δαυὶδ'))


class MandatoryExactPairTests(unittest.TestCase):
    def test_identical_repeated_tokens_keep_their_exact_positions(self):
        self.assertEqual(mandatory_exact_pairs(['the', 'word', 'the'], ['the', 'word', 'the']), {0: 0, 1: 1, 2: 2})

    def test_insertion_keeps_common_words_but_not_ambiguous_repeats(self):
        self.assertEqual(mandatory_exact_pairs(['the', 'word'], ['the', 'living', 'word']), {0: 0, 1: 2})
        self.assertEqual(mandatory_exact_pairs(['and', 'and', 'word'], ['and', 'word']), {2: 1})

    def test_reordering_never_selects_one_arbitrary_optimal_path(self):
        self.assertEqual(mandatory_exact_pairs(['faith', 'hope'], ['hope', 'faith']), {})
        self.assertEqual(mandatory_exact_pairs(['one', 'faith', 'hope', 'last'], ['one', 'hope', 'faith', 'last']), {0: 0, 3: 3})

    def test_all_binary_sequences_agree_with_exhaustive_optimal_alignment_intersection(self):
        sequences = [tuple(value) for length in range(5) for value in itertools.product('ab', repeat=length)]
        for source in sequences:
            for target in sequences:
                @lru_cache(None)
                def align(i, j):
                    if i == len(source) or j == len(target):
                        return frozenset([frozenset()])
                    paths = set(align(i + 1, j)) | set(align(i, j + 1))
                    if source[i] == target[j]:
                        paths.update(path | {(i, j)} for path in align(i + 1, j + 1))
                    longest = max(map(len, paths))
                    return frozenset(path for path in paths if len(path) == longest)
                paths = iter(align(0, 0))
                common = set(next(paths))
                for path in paths:
                    common.intersection_update(path)
                self.assertEqual(mandatory_exact_pairs(source, target), dict(common), (source, target))


if __name__ == '__main__':
    unittest.main()
