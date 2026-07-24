import { PUBLIC_DOMAIN_HYMN_TEXTS } from './publicDomainHymns.generated.js'
import { SOURCED_RUSSIAN_HYMNS } from './sourcedRussianHymns.js'

function section(label, text) {
  return {
    label,
    lines: text.trim().split('\n'),
  }
}

function publicDomainSong(song) {
  const imported = PUBLIC_DOMAIN_HYMN_TEXTS[song.id]
  const sourcedRussian = SOURCED_RUSSIAN_HYMNS[song.id]
  return {
    rightsStatus: 'public-domain-text',
    rightsLabel: 'English words: public domain. No copyrighted score, recording, or modern arrangement is included.',
    stanzas: [],
    russianStanzas: [],
    ...song,
    sections: song.sections || imported?.sections || [],
    textSourceUrl: song.textSourceUrl || imported?.textSourceUrl || song.sourceUrl || '',
    russianTitle: sourcedRussian?.title || song.russianTitle || '',
    russianSections: sourcedRussian?.sections || [],
    russianStanzas: [],
    russianRightsLabel: sourcedRussian?.rightsLabel || 'Heritage has not bundled Russian words for this hymn because no established, traceable Russian edition has been selected yet.',
    russianTextSourceUrl: sourcedRussian?.sourceUrl || '',
    russianSourceLabel: sourcedRussian?.sourceLabel || '',
  }
}

export const HERITAGE_BUILT_IN_SONGS = [
  publicDomainSong({
    id: 'amazing-grace',
    title: 'Amazing Grace',
    russianTitle: 'О, благодать',
    author: 'John Newton',
    authors: ['John Newton'],
    year: 1779,
    description: 'John Newton’s public-domain hymn of grace.',
    sourceUrl: 'https://www.hymnary.org/text/amazing_grace_how_sweet_the_sound',
    sections: [
      section('Verse 1', `Amazing grace! how sweet the sound,
That saved a wretch like me!
I once was lost, but now am found,
Was blind, but now I see.`),
      section('Verse 2', `’Twas grace that taught my heart to fear,
And grace my fears relieved;
How precious did that grace appear
The hour I first believed!`),
      section('Verse 3', `Through many dangers, toils and snares,
I have already come;
’Tis grace hath brought me safe thus far,
And grace will lead me home.`),
      section('Verse 4', `The Lord has promised good to me,
His Word my hope secures;
He will my Shield and Portion be,
As long as life endures.`),
    ],
  }),
  publicDomainSong({
    id: 'jesus-paid-it-all',
    title: 'Jesus Paid It All',
    russianTitle: 'Иисус всё уплатил',
    author: 'Elvina M. Hall',
    authors: ['Elvina M. Hall', 'John T. Grape'],
    year: 1865,
    description: 'Elvina Hall’s public-domain text. The words are independent of later arrangements.',
    sourceUrl: 'https://www.hymnary.org/text/i_hear_the_savior_say_thy_strength_indee',
    sections: [
      section('Verse 1', `I hear the Savior say,
“Thy strength indeed is small;
Child of weakness, watch and pray,
Find in Me thine all in all.”`),
      section('Chorus', `Jesus paid it all,
All to Him I owe;
Sin had left a crimson stain,
He washed it white as snow.`),
      section('Verse 2', `Lord, now indeed I find
Thy power, and Thine alone,
Can change the leper’s spots
And melt the heart of stone.`),
      section('Verse 3', `For nothing good have I
Whereby Thy grace to claim;
I’ll wash my garments white
In the blood of Calvary’s Lamb.`),
      section('Verse 4', `And when, before the throne,
I stand in Him complete,
“Jesus died my soul to save,”
My lips shall still repeat.`),
    ],
  }),
  publicDomainSong({
    id: 'be-thou-my-vision',
    title: 'Be Thou My Vision',
    russianTitle: 'Будь моим виденьем',
    author: 'Ancient Irish; versified by Eleanor H. Hull',
    authors: ['Mary E. Byrne', 'Eleanor H. Hull'],
    year: 1912,
    description: 'The public-domain English versification of an ancient Irish prayer. Modern harmonizations are separate works.',
    rightsLabel: 'This 1912 English versification is public domain in the United States. No later arrangement is included.',
    sourceUrl: 'https://www.hymnary.org/text/be_thou_my_vision_o_lord_of_my_heart',
    sections: [
      section('Verse 1', `Be Thou my Vision, O Lord of my heart;
Naught be all else to me, save that Thou art.
Thou my best Thought, by day or by night,
Waking or sleeping, Thy presence my light.`),
      section('Verse 2', `Be Thou my Wisdom, and Thou my true Word;
I ever with Thee and Thou with me, Lord;
Thou my great Father, I Thy true son;
Thou in me dwelling, and I with Thee one.`),
      section('Verse 3', `Be Thou my battle Shield, Sword for the fight;
Be Thou my Dignity, Thou my Delight;
Thou my soul’s Shelter, Thou my high Tower:
Raise Thou me heavenward, O Power of my power.`),
      section('Verse 4', `Riches I heed not, nor man’s empty praise;
Thou mine Inheritance, now and always:
Thou and Thou only, first in my heart,
High King of heaven, my Treasure Thou art.`),
      section('Verse 5', `High King of heaven, my victory won,
May I reach heaven’s joys, O bright heaven’s Sun!
Heart of my own heart, whatever befall,
Still be my Vision, O Ruler of all.`),
    ],
  }),
  publicDomainSong({
    id: 'before-the-throne',
    title: 'Before the Throne of God Above',
    russianTitle: 'Пред Божьим троном в небесах',
    author: 'Charitie Lees Bancroft',
    authors: ['Charitie Lees Bancroft'],
    year: 1863,
    description: 'The original public-domain hymn text. The popular Vikki Cook tune is a separate modern work.',
    rightsLabel: 'Original 1863 English words: public domain. The Vikki Cook tune and modern lyrical alterations are not included.',
    sourceUrl: 'https://hymnary.org/text/before_the_throne_of_god_above_i_have_a_',
  }),
  publicDomainSong({
    id: 'come-thou-fount',
    title: 'Come Thou Fount of Every Blessing',
    russianTitle: 'Приди, источник всех даров',
    author: 'Robert Robinson',
    authors: ['Robert Robinson'],
    year: 1758,
    description: 'Robert Robinson’s public-domain hymn text.',
    sourceUrl: 'https://www.hymnary.org/text/come_thou_fount_of_every_blessing',
  }),
  publicDomainSong({
    id: 'fairest-lord-jesus',
    title: 'Fairest Lord Jesus',
    russianTitle: 'Прекрасный Иисус',
    author: 'Anonymous German hymn; English translation',
    authors: [],
    year: 1873,
    description: 'A public-domain English translation of the historic German hymn.',
    sourceUrl: 'https://www.hymnary.org/text/fairest_lord_jesus_ruler_of_all_nature',
  }),
  publicDomainSong({
    id: 'give-me-jesus',
    title: 'Give Me Jesus',
    russianTitle: 'Дай мне Иисуса',
    author: 'African American spiritual',
    authors: [],
    year: 1845,
    description: 'Traditional public-domain spiritual text. Wording varies among hymnals.',
    sourceUrl: 'https://hymnary.org/text/in_the_morning_when_i_rise_in_the_morn',
  }),
  publicDomainSong({
    id: 'he-will-hold-me-fast',
    title: 'He Will Hold Me Fast',
    russianTitle: 'Он удержит меня',
    author: 'Ada R. Habershon',
    authors: ['Ada R. Habershon', 'Robert Harkness'],
    year: 1906,
    description: 'The original four public-domain Ada Habershon stanzas and Robert Harkness refrain—not the modern Matthew Merker verses or tune.',
    rightsLabel: 'Original 1906 words and tune: public domain. Matthew Merker’s 2013 additional words and music are not included.',
    sourceUrl: 'https://hymnary.org/hymn/NCH1929/310',
  }),
  publicDomainSong({
    id: 'i-know-my-redeemer-lives',
    title: 'I Know That My Redeemer Lives',
    russianTitle: 'Я знаю: мой Искупитель жив',
    author: 'Samuel Medley',
    authors: ['Samuel Medley'],
    year: 1775,
    description: 'Samuel Medley’s public-domain resurrection hymn.',
    sourceUrl: 'https://www.hymnary.org/text/i_know_that_my_redeemer_lives_what_joy',
  }),
  publicDomainSong({
    id: 'i-surrender-all',
    title: 'I Surrender All',
    russianTitle: 'Всё Тебе я отдаю',
    author: 'Judson W. Van DeVenter',
    authors: ['Judson W. Van DeVenter', 'Winfield S. Weeden'],
    year: 1896,
    description: 'Judson Van DeVenter’s public-domain hymn of surrender.',
    sourceUrl: 'https://hymnary.org/text/all_to_jesus_i_surrender',
  }),
  publicDomainSong({
    id: 'it-is-well',
    title: 'It Is Well with My Soul',
    russianTitle: 'Мир душе моей',
    author: 'Horatio G. Spafford',
    authors: ['Horatio G. Spafford', 'Philip P. Bliss'],
    year: 1873,
    description: 'Horatio Spafford’s public-domain hymn of trust in suffering.',
    sourceUrl: 'https://www.hymnary.org/text/when_peace_like_a_river_attendeth_my_way',
  }),
  publicDomainSong({
    id: 'just-as-i-am',
    title: 'Just As I Am',
    russianTitle: 'Такой, как есть',
    author: 'Charlotte Elliott',
    authors: ['Charlotte Elliott', 'William B. Bradbury'],
    year: 1835,
    description: 'Charlotte Elliott’s public-domain invitation hymn.',
    sourceUrl: 'https://hymnary.org/text/just_as_i_am_without_one_plea',
  }),
  publicDomainSong({
    id: 'nothing-but-the-blood',
    title: 'Nothing But the Blood of Jesus',
    russianTitle: 'Только кровь Иисуса',
    author: 'Robert Lowry',
    authors: ['Robert Lowry'],
    year: 1876,
    description: 'Robert Lowry’s public-domain gospel hymn.',
    sourceUrl: 'https://hymnary.org/text/what_can_wash_away_my_sin',
  }),
  publicDomainSong({
    id: 'o-come-all-ye-faithful',
    title: 'O Come, All Ye Faithful',
    russianTitle: 'Придите, все верные',
    author: 'Traditional; translated by Frederick Oakeley',
    authors: ['Frederick Oakeley'],
    year: 1841,
    description: 'The traditional public-domain English text.',
    sourceUrl: 'https://hymnary.org/text/o_come_all_ye_faithful_joyful_and_triump',
  }),
  publicDomainSong({
    id: 'o-come-o-come-emmanuel',
    title: 'O Come, O Come, Emmanuel',
    russianTitle: 'Приди, приди, Эммануил',
    author: 'Traditional; translated by John Mason Neale',
    authors: ['John Mason Neale'],
    year: 1851,
    description: 'John Mason Neale’s public-domain English translation of the ancient Advent antiphons.',
    sourceUrl: 'https://hymnary.org/text/o_come_o_come_emmanuel_and_ransom',
  }),
  publicDomainSong({
    id: 'o-my-soul-arise',
    title: 'O My Soul, Arise',
    russianTitle: 'Воспрянь, душа моя',
    author: 'Charles Wesley',
    authors: ['Charles Wesley'],
    year: 1742,
    description: 'Charles Wesley’s public-domain hymn, commonly titled “Arise, My Soul, Arise.”',
    sourceUrl: 'https://www.hymnary.org/text/arise_my_soul_arise_shake_off_thy_guilty',
  }),
  publicDomainSong({
    id: 'rock-of-ages',
    title: 'Rock of Ages',
    russianTitle: 'Скала веков',
    author: 'Augustus M. Toplady',
    authors: ['Augustus M. Toplady'],
    year: 1776,
    description: 'Augustus Toplady’s public-domain hymn.',
    sourceUrl: 'https://hymnary.org/text/rock_of_ages_cleft_for_me_let_me_hide',
  }),
  publicDomainSong({
    id: 'turn-your-eyes',
    title: 'Turn Your Eyes Upon Jesus',
    russianTitle: 'Обрати свой взор к Иисусу',
    author: 'Helen H. Lemmel',
    authors: ['Helen H. Lemmel'],
    year: 1922,
    description: 'Helen Lemmel’s 1922 public-domain text. Later arrangements and added lyrics are separate works.',
    rightsLabel: 'The 1922 English words are public domain in the United States. No later arrangement or additional verse is included.',
    sourceUrl: 'https://hymnary.org/text/turn_your_eyes_upon_jesus',
  }),
  publicDomainSong({
    id: 'what-a-friend',
    title: 'What a Friend We Have in Jesus',
    russianTitle: 'Какой Друг нам дан в Иисусе',
    author: 'Joseph M. Scriven',
    authors: ['Joseph M. Scriven', 'Charles C. Converse'],
    year: 1855,
    description: 'Joseph Scriven’s public-domain hymn.',
    sourceUrl: 'https://www.hymnary.org/text/what_a_friend_we_have_in_jesus_all_our_s',
  }),
]
