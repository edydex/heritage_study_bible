"""Guard the exact reviewed spelling pairs without relaxing edition checks."""
import unittest
from generateOriginalLanguages import greek_word


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


if __name__ == '__main__':
    unittest.main()
