"""Identity regressions for the separate pinned brief-lexicon extractor."""
import importlib.util
import json
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('brief_glosses', HERE / 'build-brief-glosses.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class BriefGlossesTest(unittest.TestCase):
    def test_nfc_equivalence_does_not_fold_accents_case_or_homographs(self):
        index = builder.index_records([{'headword': 'ῥύομαι', 'strong': '4506', 'sourceId': 'G4506', 'gloss': 'to rescue'}])
        self.assertEqual(builder.match_lemma({'lemma': 'ῥύομαι', 'strongs': ['04506']}, index)['glosses'], ['to rescue'])
        for lemma in ['ρυομαι', 'Ῥύομαι', 'ῥύομαι (II)']:
            self.assertEqual(builder.match_lemma({'lemma': lemma, 'strongs': ['4506']}, index)['status'], 'unavailable')

    def test_shared_strong_does_not_merge_different_actual_heads(self):
        index = builder.index_records([{'headword': 'κατοικέω', 'strong': '2730', 'sourceId': 'G2730', 'gloss': 'to dwell'},
                                       {'headword': 'κατοικίζω', 'strong': '6052', 'sourceId': 'G6052', 'gloss': 'to settle'}])
        self.assertEqual(builder.match_lemma({'lemma': 'κατοικέω', 'strongs': ['2730']}, index)['glosses'], ['to dwell'])
        self.assertEqual(builder.match_lemma({'lemma': 'κατοικίζω', 'strongs': ['2730']}, index)['glosses'], [])

    def test_multiple_exact_senses_stay_general_and_names_are_not_case_folded(self):
        raw = ('G4102\tG4102G =\tG4102G\tπίστις\tpistis\tG:N\tfaith\tignored definition\n'
               'G4102\tG4102H = a Meaning of\tG4102G\tπίστις\tpistis\tG:N\tfaith: faithfulness\tignored definition\n'
               'G0001\tG0001G =\tG0001G\tα, Ἄλφα\talpha\tG:N\tAlpha\tignored definition\n'
               'G2199\tG2199H =\tG2199H\t\tzebedee\tG:N\t[wife of Zebedee]\tignored\n').encode()
        records = builder.parse_records(raw)
        self.assertTrue(all(set(r) == {'headword', 'strong', 'sourceId', 'gloss'} for r in records))
        index = builder.index_records(records)
        self.assertEqual(builder.match_lemma({'lemma': 'πίστις', 'strongs': ['4102']}, index)['glosses'], ['faith', 'faith: faithfulness'])
        self.assertEqual(builder.match_lemma({'lemma': 'Ἄλφα', 'strongs': ['1']}, index)['glosses'], ['Alpha'])
        self.assertEqual(builder.match_lemma({'lemma': 'ἄλφα', 'strongs': ['1']}, index)['status'], 'unavailable')

    def test_changed_publisher_bytes_are_rejected_before_extraction(self):
        with self.assertRaisesRegex(ValueError, 'source hash'):
            builder.build(b'not the pinned source', {})

    def test_installed_inventory_retains_all_actual_lemma_identities(self):
        data_dir = HERE.parents[1] / 'public/data/original-languages'
        concordance = json.loads((data_dir / 'greek-concordance.json').read_text())
        data = json.loads((data_dir / 'greek-brief-glosses.json').read_text())
        self.assertEqual(len(data['entries']), len(concordance['lemmas']))
        for actual, entry in zip(concordance['lemmas'], data['entries']):
            self.assertEqual(actual['lemma'], entry['lemma'])
            self.assertEqual(builder.normalized_strongs(actual['strongs']), entry['strongs'])
        self.assertEqual(data['language'], 'en')
        self.assertEqual(data['counts'], {'available': 4945, 'unavailable': 457, 'multipleGlosses': 60})


if __name__ == '__main__':
    unittest.main()
