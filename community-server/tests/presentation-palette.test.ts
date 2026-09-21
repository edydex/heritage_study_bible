import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PRESENTATION_COLORS,paletteColor,patternImage,collectPresentationColors,colorDescription} from '../src/components/presentationPalette.ts'

test('palette patterns stay distinct, named, and safe SVG data images',()=>{
  assert.equal(new Set(PRESENTATION_COLORS.map(item=>patternImage(item.color))).size,PRESENTATION_COLORS.length)
  for(const item of PRESENTATION_COLORS) {
    assert.equal(paletteColor(item.color),item)
    const svg=decodeURIComponent(patternImage(item.color).slice('url("data:image/svg+xml,'.length,-2))
    assert.match(svg,/^<svg xmlns=/)
    assert.doesNotMatch(svg,/script|foreignObject|https:/)
    assert.match(colorDescription(item.color),new RegExp(item.name))
  }
  assert.equal(patternImage('<script>'),patternImage('#ffffff'))
})
test('existing custom colors retain their exact value and use a named hue family',()=>{
  assert.equal(paletteColor('#ffc000').name,'Yellow')
  assert.equal(paletteColor('#25b080').name,'Green')
  assert.equal(paletteColor('#8a5a00').name,'Orange')
  assert.equal(paletteColor('#FFFFFF').name,'White')
  assert.equal(paletteColor('#000000').name,'Black')
  assert.equal(paletteColor('#777777').name,'Gray')
  assert.equal(colorDescription('#25b080'),'Green (#25b080) · Vertical waves')
})
test('color reference reads canonical fields without changing the source project',()=>{
  const project={text:'#ff0000',title:'White',objectsByChannel:{english:[{color:'#25b080',spans:[{foreground:'#ef4444',background:'#ffc000'}]},{color:'#25b080'}]}}
  const before=JSON.stringify(project)
  assert.deepEqual(collectPresentationColors(project),['#ef4444','#25b080','#ffc000'])
  assert.equal(JSON.stringify(project),before)
})
