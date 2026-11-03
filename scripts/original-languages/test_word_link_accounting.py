import importlib.util
import unittest
from pathlib import Path
from shared_phrase_links import transfer_groups

SPEC = importlib.util.spec_from_file_location('accounting', Path(__file__).with_name('audit-nt-word-links.py'))
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)
REVIEW_SPEC = importlib.util.spec_from_file_location('reviews', Path(__file__).with_name('compile-reviewed-links.py'))
reviews = importlib.util.module_from_spec(REVIEW_SPEC)
REVIEW_SPEC.loader.exec_module(reviews)


class ArticleAuxiliaries(unittest.TestCase):
    def test_a_stranded_auxiliary_is_rejected_using_the_actual_original_article_identity(self):
        lemmas = [{'lemma': 'ὁ', 'strongs': ['3588']}, {'lemma': 'ζάω', 'strongs': ['2198']}]
        words = {'1:1': [[0, 1, 0], [2, 5, 1]]}
        reference = {'chapter': 1, 'verse': 1}
        incorrect = {'groups': [{'sourceTokens': [0], 'targetPhrases': [{'text': 'who is'}]}, {'sourceTokens': [1], 'targetPhrases': [{'text': 'living'}]}]}
        with self.assertRaisesRegex(AssertionError, 'sole Greek article'):
            reviews.validate_article_auxiliaries(incorrect, words, lemmas, reference)
        corrected = {'groups': [{'sourceTokens': [0], 'targetPhrases': [{'text': 'who'}]}, {'sourceTokens': [1], 'targetPhrases': [{'text': 'is living'}]}]}
        reviews.validate_article_auxiliaries(corrected, words, lemmas, reference)

    def test_a_foreign_source_uses_its_own_lemma_and_whole_constituents_remain_allowed(self):
        lemmas = [{'lemma': 'ὁ', 'strongs': ['3588']}, {'lemma': 'ζάω', 'strongs': ['2198']}]
        words = {'1:1': [[0, 1, 0], [2, 5, 1]], '1:2': [[0, 5, 1]]}
        reviews.validate_article_auxiliaries({'groups': [{'sourceTokens': [0], 'sourceReference': {'chapter': 1, 'verse': 2}, 'targetPhrases': [{'text': 'is living'}]}, {'sourceTokens': [0, 1], 'targetPhrases': [{'text': 'who is living'}]}]}, words, lemmas, {'chapter': 1, 'verse': 1})


class PhraseTransfer(unittest.TestCase):
    def test_split_phrases_keep_both_source_and_target_segments_without_claiming_the_pronoun(self):
        group = {'id': 0, 'source': [0, 4], 'sourceRanges': [[0, 4], [12, 16]], 'target': [0, 6], 'targetRanges': [[0, 6], [11, 15]]}
        original = 'to put her away'
        target = 'To put—her—away.'
        result = transfer_groups([group], original, target)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['sourceRanges'], group['sourceRanges'])
        self.assertEqual([target[a:b] for a, b in result[0]['targetRanges']], ['To put', 'away'])
        self.assertFalse(any(a <= target.index('her') < b for a, b in result[0]['targetRanges']))

    def test_edition_changes_cannot_transfer_only_one_segment_of_a_publisher_phrase(self):
        group = {'id': 0, 'source': [0, 4], 'target': [0, 4], 'targetRanges': [[0, 4], [8, 12]]}
        self.assertEqual(transfer_groups([group], 'send it away', 'send it home'), [])

    def test_repeated_phrases_are_not_guessed_across_changed_verses(self):
        group = {'id': 0, 'source': [0, 4], 'target': [0, 4]}
        self.assertEqual(transfer_groups([group], 'Word and Word', 'Word then Word'), [])


class WordAccounting(unittest.TestCase):
    def test_moved_clause_counts_the_actual_original_identity_once(self):
        source = {'1:1': 'α β', '1:2': 'γ'}
        target = {'1:1': 'A', '1:2': 'B C added'}
        entries = {
            '1:1': {'sourceText': 'α β', 'targetText': 'A', 'groups': [{'source': [0, 1], 'target': [0, 1]}]},
            '1:2': {'sourceText': 'γ', 'targetText': 'B C added', 'groups': [
                {'sourceAnchors': [{'chapter': 1, 'verse': 1, 'startOffset': 2, 'endOffset': 3, 'text': 'β'}], 'target': [0, 1]},
                {'source': [0, 1], 'target': [2, 3]}], 'review': {'targetNotes': [{'startOffset': 4, 'endOffset': 9, 'reason': 'Supplied word.'}]}}
        }
        counts, gaps = audit.audit_book(source, target, entries)
        self.assertEqual(counts['source'], {'words': 3, 'mappedWords': 3, 'explainedUnpairedWords': 0, 'unresolvedWords': 0, 'mappedPercent': 100})
        self.assertEqual(counts['target']['explainedUnpairedWords'], 1)
        self.assertEqual(gaps, {})
        self.assertEqual(counts['reviewedTargetVerseRecords'], 0)
        self.assertFalse(counts['completeReviewedBook'])

    def test_partially_linked_verse_does_not_hide_its_unresolved_words(self):
        counts, gaps = audit.audit_book({'1:1': 'α β'}, {'1:1': 'A B'}, {'1:1': {'sourceText': 'α β', 'targetText': 'A B', 'groups': [{'source': [0, 1], 'target': [0, 1]}]}})
        self.assertEqual(counts['linkedVerseRecords'], 1)
        self.assertEqual(counts['source']['unresolvedWords'], 1)
        self.assertEqual(counts['target']['unresolvedWords'], 1)
        self.assertEqual(gaps['1:1']['source'][0]['text'], 'β')
        self.assertEqual(gaps['1:1']['target'][0]['text'], 'B')

    def test_one_original_verb_rendered_across_two_english_references_is_counted_once(self):
        entries = {
            '1:1': {'sourceText': 'α', 'targetText': 'may', 'groups': [{'sourceAnchors': [{'chapter': 1, 'verse': 2, 'startOffset': 0, 'endOffset': 1, 'text': 'β'}], 'target': [0, 3]}], 'review': {'sourceNotes': [{'startOffset': 0, 'endOffset': 1, 'reason': 'Unexpressed grammatical word.'}]}},
            '1:2': {'sourceText': 'β', 'targetText': 'comfort', 'groups': [{'source': [0, 1], 'target': [0, 7]}]},
        }
        counts, gaps = audit.audit_book({'1:1': 'α', '1:2': 'β'}, {'1:1': 'may', '1:2': 'comfort'}, entries)
        self.assertEqual(counts['source']['mappedWords'], 1)
        self.assertEqual(counts['source']['explainedUnpairedWords'], 1)
        self.assertEqual(counts['target']['mappedWords'], 2)
        self.assertEqual(gaps, {})

    def test_a_source_only_boundary_review_does_not_inflate_the_reviewed_english_verse_count(self):
        source = {'1:1': 'α', '1:2': 'β'}
        target = {'1:1': 'A B'}
        entries = {
            '1:1': {'sourceText': 'α', 'targetText': 'A B', 'groups': [{'source': [0, 1], 'target': [0, 1]}, {'sourceAnchors': [{'chapter': 1, 'verse': 2, 'startOffset': 0, 'endOffset': 1, 'text': 'β'}], 'target': [2, 3]}], 'review': {'completeAccounting': True}},
            '1:2': {'sourceText': 'β', 'targetText': '', 'groups': [], 'targetAbsent': True, 'review': {'completeAccounting': True}},
        }
        counts, gaps = audit.audit_book(source, target, entries)
        self.assertEqual(counts['reviewedTargetVerseRecords'], 1)
        self.assertEqual(counts['reviewedSourceOnlyRecords'], 1)
        self.assertTrue(counts['completeReviewedBook'])
        self.assertEqual(gaps, {})

    def test_an_unreviewed_alternative_original_ending_keeps_the_book_incomplete(self):
        source = {'16:8': 'α', '16:99': 'β'}
        target = {'16:8': 'A'}
        entries = {'16:8': {'sourceText': 'α', 'targetText': 'A', 'groups': [{'source': [0, 1], 'target': [0, 1]}], 'review': {'completeAccounting': True}}}
        counts, gaps = audit.audit_book(source, target, entries)
        self.assertTrue(counts['allTargetReferencesReviewed'])
        self.assertFalse(counts['completeReviewedBook'])
        self.assertEqual(gaps['16:99']['source'][0]['text'], 'β')


if __name__ == '__main__':
    unittest.main()
