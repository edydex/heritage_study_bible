import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('full_text', Path(__file__).with_name('align-full-text.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def word(text, start, end, score=.9):
    return {'text': text, 'start': start, 'end': end, 'score': score}


class CompleteTextAssessment(unittest.TestCase):
    def test_preserves_intentionally_blank_verse_without_consuming_audio(self):
        verses = [{'number': 20, 'text': 'Light'}, {'number': 21, 'text': ''}, {'number': 22, 'text': 'Darkness'}]
        result = module.assess(verses, [word('light', 0, 1), word('darkness', 2, 3)], 4)
        self.assertEqual(result[1]['reasons'], ['no-spoken-text'])
        self.assertEqual(result[1]['words'], [])
        self.assertEqual(result[2]['start'], 2)
        # A blank verse must not hide an overlap between spoken verses.
        overlap = module.assess(verses, [word('light', 0, 2.5), word('darkness', 2, 3)], 4)
        self.assertIn('verse-overlap', overlap[0]['reasons'])
        self.assertIn('verse-overlap', overlap[2]['reasons'])

    def test_preserves_complete_verse_and_rejects_truncation(self):
        verses = [{'number': 3, 'text': 'And there was light.'}]
        words = [word(w, i, i + .8) for i, w in enumerate(['and', 'there', 'was', 'light'])]
        result = module.assess(verses, words, 5)
        self.assertEqual(result[0]['text'], 'and there was light')
        self.assertEqual(result[0]['reasons'], [])
        with self.assertRaises(ValueError):
            module.assess(verses, words[:-1], 5)

    def test_rejects_numeric_tokens_without_altering_them(self):
        result = module.assess([{'number': 1, 'text': '12 men'}], [word('12', 0, .7), word('men', .8, 1.4)], 3)
        self.assertEqual(result[0]['text'], '12 men')
        self.assertIn('numeric-token-needs-review', result[0]['reasons'])

    def test_excludes_both_sides_of_overlapping_verses(self):
        verses = [{'number': 1, 'text': 'Light'}, {'number': 2, 'text': 'Darkness'}]
        result = module.assess(verses, [word('light', 0, 1), word('darkness', .8, 1.8)], 3)
        self.assertTrue(all('verse-overlap' in v['reasons'] for v in result))

    def test_rejects_bad_boundary_even_with_high_average(self):
        result = module.assess([{'number': 1, 'text': 'And light'}], [word('and', 0, .5, .2), word('light', .7, 1, 1)], 3)
        self.assertIn('low-confidence', result[0]['reasons'])

    def test_rejects_out_of_recording_and_collapsed_spans(self):
        for end, duration, reason in [(4, 3, 'invalid-span'), (.02, 3, 'implausible-duration')]:
            result = module.assess([{'number': 1, 'text': 'Light'}], [word('light', 0, end)], duration)
            self.assertIn(reason, result[0]['reasons'])

    def test_rejects_word_substitution_and_extra_words(self):
        for words in [[word('dark', 0, 1)], [word('light', 0, 1), word('extra', 2, 3)]]:
            with self.assertRaises(ValueError):
                module.assess([{'number': 1, 'text': 'Light'}], words, 4)


if __name__ == '__main__':
    unittest.main()
