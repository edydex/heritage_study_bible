import copy, importlib.util, unittest
from pathlib import Path

F=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('private_reviews',F/'compile-reviewed-links.py')
reviews=importlib.util.module_from_spec(spec);spec.loader.exec_module(reviews)

class ExplicitStudyHeadContracts(unittest.TestCase):
 def base(self):
  return {'sourceText':'α β γ','targetText':'Первое второе третье','groups':[
   {'sourceTokens':[0,1],'targetPhrases':[{'text':'Первое второе','occurrence':0}], 'studyHeads':[
    {'sourceTokens':[1],'targetPhrases':[{'text':'второе','occurrence':0}],'note':'Synthetic schema fixture: choose an actual member of this group.'}]},
   {'sourceTokens':[2],'targetPhrases':[{'text':'третье','occurrence':0}]}]}
 def compile(self,e):return reviews.compile_verse(e,e['sourceText'],e['targetText'],reference={'chapter':1,'verse':1})
 def test_head_uses_real_source_and_cyrillic_offsets_without_reassigning_the_group(self):
  e=self.base();before=copy.deepcopy(e);del before['groups'][0]['studyHeads'];old=self.compile(before);new=self.compile(e)
  head=new['groups'][0].pop('studyHeads')[0]
  self.assertEqual(old,new)
  self.assertEqual(head['sourceAnchors'],[{'chapter':1,'verse':1,'startOffset':2,'endOffset':3,'text':'β'}])
  self.assertEqual([e['targetText'][a:b] for a,b in head['targetRanges']],['второе'])
 def test_adjacent_selected_words_keep_individual_source_identities(self):
  e=self.base();e['groups'][0]['studyHeads'][0]['sourceTokens']=[0,1]
  heads=self.compile(e)['groups'][0]['studyHeads'][0]['sourceAnchors']
  self.assertEqual([(h['startOffset'],h['endOffset'],h['text']) for h in heads],[(0,1,'α'),(2,3,'β')])
 def test_phrase_transfer_never_copies_wording_specific_head_offsets(self):
  spec=importlib.util.spec_from_file_location('private_transfer',F/'shared_phrase_links.py');transfer=importlib.util.module_from_spec(spec);spec.loader.exec_module(transfer)
  group={'id':0,'source':[0,2],'target':[0,4],'studyHeads':[{'targetRanges':[[0,4]],'sourceAnchors':[],'note':'Synthetic offset fixture.'}]}
  moved=transfer.transfer_groups([group],'Word','A Word')[0]
  self.assertEqual(moved['target'],[2,6]);self.assertNotIn('studyHeads',moved);self.assertIn('studyHeads',group)
 def test_rejects_sources_outside_the_group_and_ambiguous_overlapping_choices(self):
  changes=[lambda h:h.update(sourceTokens=[2]),lambda h:h.update(sourceTokens=[1,1]),lambda h:h.update(sourceTokens=[True]),lambda h:h.update(sourceTokens=[]),lambda h:h.update(sourceTokens={1:'x'}),lambda h:h.update(sourceReference={'chapter':1,'verse':99}),lambda h:h.update(note=''),lambda h:h.update(targetPhrases=[]),lambda h:h.update(targetPhrases=[{'text':'третье','occurrence':0}])]
  for change in changes:
   e=self.base();change(e['groups'][0]['studyHeads'][0])
   with self.subTest(e=e),self.assertRaises(AssertionError):self.compile(e)
  e=self.base();e['groups'][0]['studyHeads'].append(copy.deepcopy(e['groups'][0]['studyHeads'][0]))
  with self.assertRaisesRegex(AssertionError,'Overlapping study head'):self.compile(e)
 def test_foreign_group_heads_inherit_actual_reference_without_falling_back_to_local_words(self):
  e={'sourceText':'γ','targetText':'Первое второе','groups':[{'sourceTokens':[0,1],'sourceReference':{'chapter':1,'verse':1},'targetPhrases':[{'text':'Первое второе'}],'studyHeads':[{'sourceTokens':[1],'targetPhrases':[{'text':'второе'}],'note':'Synthetic foreign-reference contract.'}]}],'unmappedSource':[{'tokens':[0],'reason':'Synthetic local-word gap.'}]}
  compiled=reviews.compile_verse(e,e['sourceText'],e['targetText'],source_verses={'1:1':'α β','1:2':'γ'},reference={'chapter':1,'verse':2})
  self.assertEqual(compiled['groups'][0]['studyHeads'][0]['sourceAnchors'],[{'chapter':1,'verse':1,'startOffset':2,'endOffset':3,'text':'β'}])

if __name__=='__main__':unittest.main()
