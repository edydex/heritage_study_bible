import unittest
from match import coalesce_anchors, match_recording
TEXT='The gracious king walked across the bright meadow with his faithful companion today.'
def transcript(text=TEXT,probability=.95):
 return {'segments':[{'words':[{'word':w,'start':i*.35,'end':i*.35+.3,'probability':probability} for i,w in enumerate(text.split())]}]}
def book(paragraphs=None):return {'chapters':[{'title':'Chapter 1','paragraphs':paragraphs or [TEXT]}]}
class Matches(unittest.TestCase):
 def test_repeated_phrase_offsets_merge_and_conflicting_overlaps_are_rejected(self):
  anchors=[{'start':3.,'end':7.,'paragraph':'0:0'},{'start':1.,'end':5.,'paragraph':'0:0'}]
  self.assertEqual(coalesce_anchors(anchors),[{'start':1.,'end':7.,'paragraph':'0:0'}])
  anchors.append({'start':6.,'end':9.,'paragraph':'0:1'})
  self.assertEqual(coalesce_anchors(anchors),[])
 def test_exact_unique_phrase_creates_paragraph_anchor_without_rewriting(self):
  out=match_recording(transcript(),book(),100)
  self.assertEqual(out['spans'],[{'start':0.,'end':4.5,'paragraph':'0:0'}]);self.assertEqual(out['paragraphs']['0:0']['text'],TEXT)
 def test_ambiguous_and_unrelated_phrases_have_no_destination(self):
  self.assertFalse(match_recording(transcript(),book([TEXT,TEXT]),100)['spans'])
  self.assertFalse(match_recording(transcript('This introduction was recorded for a different audiobook entirely.'),book(),100)['spans'])
 def test_low_confidence_silence_and_bad_time_are_rejected(self):
  self.assertFalse(match_recording(transcript(probability=.1),book(),100)['spans'])
  t=transcript();t['segments'][0]['no_speech_prob']=.9
  self.assertFalse(match_recording(t,book(),100)['spans'])
  t=transcript();t['segments'][0]['words'][6]['end']=float('nan')
  self.assertFalse(match_recording(t,book(),1)['spans'])
 def test_never_fills_long_silence(self):
  t=transcript(TEXT+' '+TEXT)
  for w in t['segments'][0]['words'][14:]: w['start']+=40;w['end']+=40
  out=match_recording(t,book(),100)
  self.assertGreater(len(out['spans']),1)
  self.assertLess(out['spans'][0]['end'],10)
  self.assertGreater(out['spans'][-1]['start'],40)
if __name__=='__main__':unittest.main()
