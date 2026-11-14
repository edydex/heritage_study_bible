"""Real-corpus bootstrap contracts; these checks do not certify new semantics."""
import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location('synodal_builder', Path(__file__).with_name('build-synodal-links.py'))
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)
ROOT = builder.ROOT
PRIVATE = ROOT / 'artifacts/nt-word-links-20261102/synodal-word-links-bootstrap-20261104'
PRIVATE_FIXTURE = '--private-fixture' in sys.argv
if PRIVATE_FIXTURE:
    sys.argv.remove('--private-fixture')
ROMANS_SHA = 'cfbecf38f118858636665be2c1fd4251b6aabefe6fcdc84c12d9e0d03e0c320c'
AUTHOR_SHA = '7f4222b319908fda93bfb6b9f9f375a1b66d4197bd1f95e8f1717cd926b1d3f9'
PEER_SHA = 'd6b89e2cf782b240caf8f8c575f9997637a090e374c0e772f7a8af2310e67a53'
SHARED = {'Romans': {'1:3:0': ['1:3', '1:4'], '1:28:10': ['1:28', '1:29']}}
EXPECTED = {'reviewedVerses': 32, 'groups': 426, 'sourceWords': 543,
            'mappedSourceWords': 471, 'explainedSourceWords': 72,
            'targetWords': 488, 'mappedTargetWords': 471,
            'explainedTargetWords': 17, 'exclusiveMovedTokens': 1}


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def verse(data, book, chapter, number):
    return next(v for b in data['books'] if b['name'] == book
                for c in b['chapters'] if c['number'] == chapter
                for v in c['verses'] if v['number'] == number)


class SynodalBootstrap(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workspace = tempfile.TemporaryDirectory(prefix='heritage-synodal-link-tests-')
        cls.folder = Path(cls.workspace.name)
        # Root adopts this exact source before clean-checkout CI. During the
        # private handoff, the owner-authorized proposal is the same byte source.
        adopted = ROOT / 'scripts/original-languages/reviewed-syno-w/romans-1.json'
        source = PRIVATE / 'reviewed-syno-w/romans-1.json' if PRIVATE_FIXTURE else adopted
        if not source.exists():
            raise RuntimeError('Adopted reviewed-syno-w/romans-1.json is required. '
                               'Use --private-fixture only for the explicit private bootstrap handoff.')
        builder.pinned(source, ROMANS_SHA, 'Test reviewed pilot')
        cls.reviews = cls.folder / 'reviews'
        cls.reviews.mkdir()
        (cls.reviews / 'romans-1.json').write_bytes(source.read_bytes())
        cls.registry_value = {'schemaVersion': 1, 'targetId': 'SYNO-W', 'crossReferenceShared': SHARED,
                              'resources': [
            {'file': 'romans-1.json', 'sha256': ROMANS_SHA, 'status': 'accepted',
             'authorReceipt': {'sha256': AUTHOR_SHA},
             'independentPeer': {'sha256': PEER_SHA}}]}
        cls.registry = cls.folder / 'registry.json'
        write(cls.registry, cls.registry_value)
        cls.original = builder.read(ROOT / 'public/data/translations/SYNO-W.json')
        script = """
const fs=require('node:fs');const root=process.argv[1];
const read=p=>JSON.parse(fs.readFileSync(root+'/'+p,'utf8'));
const {resolveSynodalNtVersification}=require(root+'/scripts/lib/synodalNtVersification.cjs');
const p=resolveSynodalNtVersification({nativeData:read('public/data/translations/SYNO-W-native.json'),canonicalTemplateData:read('public/data/translations/LSV.json'),policy:read('scripts/bible-sources/SYNO-W-nt-versification.json')});
process.stdout.write(JSON.stringify(p.books));
"""
        cls.nt_books = json.loads(subprocess.check_output(['node', '-e', script, str(ROOT)], text=True))
        cls.names = {book['name'] for book in cls.nt_books}
        cls.planned = copy.deepcopy(cls.original)
        cls.planned['books'] = [book for book in cls.planned['books'] if book['name'] not in cls.names] + cls.nt_books
        cls.target = cls.folder / 'planned-SYNO-W.json'
        write(cls.target, cls.planned)
        cls.output = cls.folder / 'first-output'
        cls.report = builder.build(output=cls.output, reviews=cls.reviews, registry=cls.registry, target_corpus=cls.target)

    @classmethod
    def tearDownClass(cls):
        cls.workspace.cleanup()

    def build(self, **kwargs):
        options = {'output': self.folder / self._testMethodName, 'reviews': self.reviews,
                   'registry': self.registry, 'target_corpus': self.target}
        options.update(kwargs)
        return builder.build(**options)

    def test_real_complete_nt_and_only_reviewed_pilot_are_installed(self):
        index = builder.read(self.output / 'index.json')
        self.assertEqual(len(index['books']), 27)
        self.assertEqual(index['targetId'], 'SYNO-W')
        self.assertEqual(index['sourceId'], 'N1904')
        self.assertEqual(index['reviewedVerseCount'], 32)
        self.assertEqual(self.report['reviewed'], EXPECTED)
        self.assertEqual(self.report['targetVerseRecords'], 7958)
        self.assertEqual(self.report['unreviewedTargetVerseRecords'], 7926)
        self.assertEqual(set(self.report['greekOnlyUnreviewedReferences']), {'Mark|16|99', 'Revelation|12|18'})
        for name, meta in index['books'].items():
            path = self.output / meta['file']
            self.assertEqual(builder.sha(path), meta['sha256'])
            book = builder.read(path)
            self.assertEqual((book['book'], book['sourceId'], book['targetId'], book['schemaVersion']),
                             (name, 'N1904', 'SYNO-W', 1))
            self.assertEqual(book['provenance']['greekSha256'], builder.RAW_GREEK_SHA)
            self.assertEqual(set(book['verses']), {f'1:{v}' for v in range(1, 33)} if name == 'Romans' else set())
            self.assertFalse(set(book['verses']) & set(book['unavailable']))
            self.assertTrue(all(reason.endswith('unreviewed') or reason == 'not-independently-reviewed'
                                for reason in book['unavailable'].values()))
        matthew = builder.read(self.output / 'matthew.json')
        self.assertEqual(matthew['verses'], {})
        self.assertEqual(matthew['unavailable']['1:1'], 'not-independently-reviewed')
        revelation = builder.read(self.output / 'revelation.json')
        self.assertNotIn('12:18', revelation['verses'])
        self.assertEqual(revelation['unavailable']['12:18'], 'target-reference-absent-unreviewed')

    def test_reviewed_greek_only_reference_leaves_the_unreviewed_list(self):
        source = builder.compiler.corpus(builder.read(builder.DATA / 'greek-nt-n1904.json'))['Mark']['16:99']
        reviews = self.folder / 'reviews-with-greek-only'
        reviews.mkdir()
        (reviews / 'romans-1.json').write_bytes((self.reviews / 'romans-1.json').read_bytes())
        resource = reviews / 'mark-16.json'
        write(resource, {
            'schemaVersion': 1, 'book': 'Mark', 'targetId': 'SYNO-W', 'sourceId': 'N1904',
            'verses': {'16:99': {
                'sourceText': source, 'targetText': '', 'targetAbsent': True, 'groups': [],
                'unmappedSource': [{
                    'tokens': list(range(len(source.split()))),
                    'reason': 'This Greek-only ending has no corresponding displayed Synodal verse.',
                }],
            }},
        })
        registry = copy.deepcopy(self.registry_value)
        registry['resources'].append({
            'file': resource.name, 'sha256': builder.sha(resource), 'status': 'accepted',
            'authorReceipt': {'sha256': AUTHOR_SHA}, 'independentPeer': {'sha256': PEER_SHA},
        })
        registry_path = self.folder / 'registry-with-greek-only.json'
        write(registry_path, registry)
        output = self.folder / 'greek-only-output'
        report = self.build(output=output, reviews=reviews, registry=registry_path)
        index = builder.read(output / 'index.json')
        mark = builder.read(output / 'mark.json')
        self.assertEqual(report['greekOnlyUnreviewedReferences'], ['Revelation|12|18'])
        self.assertEqual(index['coverage']['greekOnlyUnreviewedReferences'], ['Revelation|12|18'])
        self.assertEqual(index['reviewedVerseCount'], 33)
        self.assertEqual(report['unreviewedTargetVerseRecords'], 7926)
        self.assertTrue(mark['verses']['16:99']['targetAbsent'])
        self.assertFalse(mark['verses']['16:99']['groups'])
        self.assertNotIn('16:99', mark['unavailable'])

    def test_actual_moved_shared_and_preferred_head_identities_survive_compilation(self):
        roman = builder.read(self.output / 'romans.json')['verses']
        source = builder.compiler.corpus(builder.read(builder.DATA / 'greek-nt-n1904.json'))['Romans']
        moved = roman['1:29']['review']['sourceMoved']
        self.assertEqual(len(moved), 1)
        self.assertEqual(moved[0]['targetReference'], {'chapter': 1, 'verse': 30})
        anchors = [a for group in roman['1:30']['groups'] for a in group['sourceAnchors'] if a['verse'] == 29]
        self.assertEqual(len(anchors), 1)
        self.assertEqual(anchors[0]['text'], 'ψιθυριστάς,')
        self.assertEqual(anchors[0]['startOffset'], moved[0]['startOffset'])
        for entry in roman.values():
            for group in entry['groups']:
                for anchor in group['sourceAnchors']:
                    text = source[f"{anchor['chapter']}:{anchor['verse']}"]
                    self.assertEqual(text[anchor['startOffset']:anchor['endOffset']], anchor['text'])
        heads = [head for group in roman['1:19']['groups'] for head in group.get('studyHeads', [])]
        self.assertEqual(len(heads), 1)
        self.assertEqual(heads[0]['sourceAnchors'][0]['text'], 'αὐτοῖς·')
        self.assertEqual([roman['1:19']['targetText'][a:b] for a, b in heads[0]['targetRanges']], ['них'])
        paired = next(group for group in roman['1:19']['groups'] if group.get('studyHeads'))
        self.assertIn('ἐν', [source['1:19'][a:b] for a, b in paired.get('sourceRanges', [paired['source']])][0])

    def test_unreviewed_words_remain_unresolved_in_existing_audit(self):
        audit = builder.load_module('synodal_existing_audit', 'audit-nt-word-links.py')
        source = builder.compiler.corpus(builder.read(builder.DATA / 'greek-nt-n1904.json'))
        target = builder.compiler.corpus(self.planned)
        counts, _ = audit.audit_book(source['Romans'], target['Romans'], builder.read(self.output / 'romans.json')['verses'])
        self.assertEqual(counts['reviewedTargetVerseRecords'], 32)
        self.assertEqual(counts['source']['mappedWords'], 471)
        self.assertEqual(counts['source']['explainedUnpairedWords'], 72)
        self.assertEqual(counts['target']['mappedWords'], 471)
        self.assertEqual(counts['target']['explainedUnpairedWords'], 17)
        self.assertGreater(counts['source']['unresolvedWords'], 0)
        self.assertGreater(counts['target']['unresolvedWords'], 0)
        self.assertFalse(counts['completeReviewedBook'])
        counts, _ = audit.audit_book(source['Matthew'], target['Matthew'], {})
        self.assertEqual(counts['source']['mappedWords'], 0)
        self.assertEqual(counts['source']['explainedUnpairedWords'], 0)
        self.assertEqual(counts['target']['mappedWords'], 0)
        self.assertEqual(counts['target']['explainedUnpairedWords'], 0)

    def test_deterministic_reproduction_preserves_ot_and_inputs(self):
        before = {path: builder.sha(path) for path in [self.target, self.registry, self.reviews / 'romans-1.json']}
        output = self.folder / 'repeat-output'
        report = self.build(output=output)
        self.assertEqual(report, self.report)
        self.assertEqual({p.name: p.read_bytes() for p in output.glob('*.json')},
                         {p.name: p.read_bytes() for p in self.output.glob('*.json')})
        self.assertEqual(before, {path: builder.sha(path) for path in before})
        self.assertEqual([b for b in self.planned['books'] if b['name'] not in self.names],
                         [b for b in self.original['books'] if b['name'] not in self.names])

    def test_unregistered_draft_is_never_read_or_applied(self):
        reviews = self.folder / 'reviews-with-unapproved-draft'
        reviews.mkdir()
        (reviews / 'romans-1.json').write_bytes((self.reviews / 'romans-1.json').read_bytes())
        (reviews / 'romans-2.json').write_text('Unapproved unfinished draft, deliberately not JSON.')
        output = self.folder / 'draft-excluded-output'
        self.build(output=output, reviews=reviews)
        self.assertEqual({p.name: p.read_bytes() for p in output.glob('*.json')},
                         {p.name: p.read_bytes() for p in self.output.glob('*.json')})

    def test_old_proportional_russian_is_rejected_before_output(self):
        old = copy.deepcopy(self.planned)
        # Exact former public Acts19:22, incorrectly shifted from native19:21.
        verse(old, 'Acts', 19, 22)['text'] = 'Когда же это совершилось, Павел положил в духе, пройдя Македонию и Ахаию, идти в Иерусалим, сказав: побывав там, я должен видеть и Рим.'
        path = self.folder / 'old-proportional-target.json'
        write(path, old)
        output = self.folder / 'rejected-output'
        with self.assertRaisesRegex(ValueError, 'differs from reviewed source-piece plan'):
            self.build(target_corpus=path, output=output)
        self.assertFalse(output.exists())

    def test_changed_russian_word_and_missing_or_duplicate_ref_are_rejected(self):
        for kind in ['changed', 'missing', 'duplicate', 'wrong-id']:
            bad = copy.deepcopy(self.planned)
            if kind == 'changed':
                verse(bad, 'Romans', 1, 1)['text'] += ' изменено'
            elif kind in ['missing', 'duplicate']:
                chapter = next(c for b in bad['books'] if b['name'] == 'Romans' for c in b['chapters'] if c['number'] == 1)
                if kind == 'missing':
                    chapter['verses'].pop()
                else:
                    chapter['verses'].append(copy.deepcopy(chapter['verses'][0]))
            else:
                bad['translation'] = 'KJV'
            path = self.folder / f'target-{kind}.json'
            write(path, bad)
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                self.build(target_corpus=path)

    def test_unapproved_registry_sha_missing_peer_and_duplicate_approval_are_rejected(self):
        for kind in ['sha', 'peer', 'duplicate', 'missing']:
            bad = copy.deepcopy(self.registry_value)
            if kind == 'sha':
                bad['resources'][0]['sha256'] = '0' * 64
            elif kind == 'peer':
                bad['resources'][0].pop('independentPeer')
            elif kind == 'duplicate':
                bad['resources'] *= 2
            else:
                bad['resources'] = []
            path = self.folder / f'registry-{kind}.json'
            write(path, bad)
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                self.build(registry=path)

    def test_review_and_actual_greek_metadata_source_pins_are_enforced(self):
        for kind in ['review', 'greek', 'concordance']:
            path = self.folder / f'changed-{kind}.json'
            options = {}
            if kind == 'review':
                reviews = self.folder / 'changed-reviews'
                reviews.mkdir(exist_ok=True)
                data = builder.read(self.reviews / 'romans-1.json')
                data['verses']['1:1']['targetText'] += ' другое'
                write(reviews / 'romans-1.json', data)
                options['reviews'] = reviews
            else:
                original = builder.DATA / ('greek-nt-n1904.json' if kind == 'greek' else 'greek-concordance.json')
                data = builder.read(original)
                data['unexpected'] = True
                write(path, data)
                options['greek_corpus' if kind == 'greek' else 'concordance_path'] = path
            with self.subTest(kind=kind), self.assertRaisesRegex(ValueError, 'source pin changed'):
                self.build(**options)

    def test_missing_moved_counterpart_is_rejected_even_with_valid_local_accounting(self):
        approved = builder.approved_resources(self.reviews, self.registry, self.names)
        bad = copy.deepcopy(approved)
        entry = bad[0][2]['verses']['1:30']
        foreign = next(group for group in entry['groups'] if group.get('sourceReference', {}).get('verse') == 29)
        entry['groups'].remove(foreign)
        entry['unmappedTarget'].append({**foreign['targetPhrases'][0], 'reason': 'Test removed moved counterpart.'})
        source = builder.compiler.corpus(builder.read(builder.DATA / 'greek-nt-n1904.json'))
        books = {'Romans': {'verses': {}, 'unavailable': {}, '_target': builder.compiler.corpus(self.planned)['Romans']}}
        with self.assertRaisesRegex(ValueError, 'Moved source must have its exact exclusive destination'):
            builder.apply_reviews(books, bad, source, builder.read(builder.DATA / 'greek-concordance.json'), SHARED)

    def test_registry_authority_allows_new_resource_names_without_a_pilot_filename_ceiling(self):
        reviews = self.folder / 'new-approved-resource-name'
        reviews.mkdir()
        filename = 'romans-full-chapter-one.json'
        (reviews / filename).write_bytes((self.reviews / 'romans-1.json').read_bytes())
        status = copy.deepcopy(self.registry_value)
        status['resources'][0]['file'] = filename
        registry = self.folder / 'renamed-approved-registry.json'
        write(registry, status)
        report = self.build(reviews=reviews, registry=registry)
        self.assertEqual(report['reviewed'], EXPECTED)

    def test_shared_source_reuse_requires_the_exact_registry_owner_declarations(self):
        status = copy.deepcopy(self.registry_value)
        status['crossReferenceShared']['Romans'].pop('1:28:10')
        registry = self.folder / 'undeclared-shared-owner-registry.json'
        write(registry, status)
        with self.assertRaisesRegex(ValueError, 'Unexpected shared source identities'):
            self.build(registry=registry)


if __name__ == '__main__':
    unittest.main()
