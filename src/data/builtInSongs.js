import { PUBLIC_DOMAIN_HYMN_TEXTS } from './publicDomainHymns.generated.js'
import { CURATED_PUBLIC_DOMAIN_HYMNS } from './curatedPublicDomainHymns.js'

const HERITAGE_RUSSIAN_NOTE = 'Russian words: a new Heritage translation drafted directly from the public-domain English text in 2026. It was not copied from a published Russian hymnal, is not tied to a copyrighted arrangement, and should be reviewed locally for congregational rhythm. Heritage waives any rights it may hold in this draft under CC0.'

function section(label, text) {
  return {
    label,
    lines: text.trim().split('\n'),
  }
}

function publicDomainSong(song) {
  const imported = PUBLIC_DOMAIN_HYMN_TEXTS[song.id]
  const curated = CURATED_PUBLIC_DOMAIN_HYMNS[song.id]
  return {
    rightsStatus: 'public-domain-text',
    rightsLabel: 'English words: public domain. No copyrighted score, recording, or modern arrangement is included.',
    russianRightsLabel: HERITAGE_RUSSIAN_NOTE,
    stanzas: [],
    russianStanzas: [],
    sections: imported?.sections || curated?.sections || [],
    russianSections: curated?.russianSections || [],
    textSourceUrl: imported?.textSourceUrl || '',
    ...song,
  }
}

function catalogOnlySong(song) {
  return {
    rightsStatus: 'metadata-only',
    stanzas: [],
    russianStanzas: [],
    sections: [],
    russianSections: [],
    russianRightsLabel: 'No Russian words are bundled by Heritage: a translation of this still-copyrighted song is a separate version, and no translator or permission record has been identified. A Community may publish the version it is authorized to use.',
    ...song,
  }
}

export const HERITAGE_BUILT_IN_SONGS = [
  catalogOnlySong({
    id: 'all-i-have-is-christ',
    title: 'All I Have Is Christ',
    russianTitle: 'Я живу Христом',
    author: 'Jordan Kauflin',
    authors: ['Jordan Kauflin'],
    year: 2008,
    description: 'A modern Sovereign Grace song. Heritage includes the catalog record, while licensed Communities can supply their own lyrics or files.',
    rightsLabel: 'Words and music © 2008 Sovereign Grace Praise (BMI), administered by Integrity Music. Heritage does not bundle the lyrics.',
    sourceUrl: 'https://www.jordankauflin.com/allihaveischrist',
    permissionUrl: 'https://sovereigngracemusic.com/about/permissions/',
  }),
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
    russianSections: [
      section('Куплет 1', `О благодать! Как сладок звук:
Спасён был грешник ей.
Я был потерян — найден вдруг,
Был слеп — прозрел теперь.`),
      section('Куплет 2', `Мне благодать открыла страх
И страх мой уняла;
Как драгоценен был тот час,
Когда пришла вера.`),
      section('Куплет 3', `Сквозь множество скорбей и бед
Я милостью прошёл;
Она хранила до сих пор
И приведёт домой.`),
      section('Куплет 4', `Мне обещал Господь добро,
В Его словах надежда;
Он щит и часть моя вовек,
Пока дышу я здесь.`),
    ],
  }),
  catalogOnlySong({
    id: 'as-the-deer',
    title: 'As the Deer',
    russianTitle: 'Как олень жаждет к водам',
    author: 'Martin J. Nystrom',
    authors: ['Martin J. Nystrom'],
    year: 1984,
    description: 'A modern worship song based on Psalm 42.',
    rightsLabel: 'Copyrighted words and music; CCLI Song No. 1431. Heritage includes only the catalog record.',
    sourceUrl: 'https://hymnary.org/hymn/LUYH2013/503',
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
    russianSections: [
      section('Куплет 1', `Я слышу голос Твой:
«Ты слаб, дитя Моё;
Бодрствуй, молись и всё, что нужно,
Во Мне одном найдёшь».`),
      section('Припев', `Иисус всё уплатил,
Я всем обязан Ему;
Грех оставил алый след —
Он сделал белым, как снег.`),
      section('Куплет 2', `Господь, теперь я знаю:
Лишь сила Твоя
Пятно проказы очищает
И камень сердца плавит.`),
      section('Куплет 3', `Нет доброго во мне,
Чем благодать купить;
Омою белыми одежды
Кровью Агнца с Голгофы.`),
      section('Куплет 4', `Когда пред Троном я
В Нём совершенным встану,
«Иисус умер, чтоб спасти» —
Уста мои повторят.`),
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
    russianSections: [
      section('Куплет 1', `Будь мне виденьем, Господь сердца мой;
Всё остальное ничто пред Тобой.
Лучшая мысль Ты и ночью, и днём;
Сплю иль бодрствую — свет мой в Тебе.`),
      section('Куплет 2', `Будь мне премудростью, истинным Словом;
Я пребываю с Тобой, Ты со мною.
Ты — Отец вечный, я принят Тобой;
Ты обитаешь во мне, мы едины.`),
      section('Куплет 3', `Будь моим щитом и мечом для борьбы,
Честью, отрадой, убежищем Ты.
Башней высокой для духа будь мне;
К небу возвысь меня силой Твоей.`),
      section('Куплет 4', `Мне не богатство, не слава людей —
Ты моё всё и наследье навек.
Первым и главным будь в сердце моём,
Царь высоты, драгоценность моя.`),
      section('Куплет 5', `Царь в небесах, после полной победы
Дай мне увидеть небесную радость.
Сердце сердца моего, что б ни пришло,
Будь мне виденьем, Владыка всего.`),
    ],
  }),
  catalogOnlySong({
    id: 'because-he-lives',
    title: 'Because He Lives',
    russianTitle: 'Потому что Он живёт',
    author: 'Bill and Gloria Gaither',
    authors: ['Bill Gaither', 'Gloria Gaither'],
    year: 1971,
    description: 'A modern Gaither hymn. A Community can add the edition covered by its license.',
    rightsLabel: 'Copyrighted words and music; CCLI Song No. 16880. Heritage includes only the catalog record.',
    sourceUrl: 'https://hymnary.org/text/god_sent_his_son_they_called_him_jesus',
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
    russianStanzas: [
      `Пред Божьим троном в небесах
Есть совершенный мой ответ:
Великий Первосвященник — Любовь —
Живёт и молится за меня.
Моё имя на Его руках,
Моё имя в Его сердце.
Пока Он пред Отцом стоит,
Никто меня не отлучит.`,
      `Когда враг шепчет о вине
И погружает в безнадёжность,
Я поднимаю взгляд к Христу:
Он уничтожил весь мой грех.
Безгрешный Спаситель умер,
И грешная душа свободна;
Праведный Бог удовлетворён,
Взирая на Него, простить меня.`,
      `Вот воскресший Агнец там,
Моя безупречная праведность,
Великий неизменный Сущий,
Царь славы, милости и благодати.
Я с Ним един и не умру:
Душа куплена Его кровью;
Моя жизнь сокрыта со Христом —
С моим Спасителем и Богом.`,
    ],
  }),
  catalogOnlySong({
    id: 'behold-our-god',
    title: 'Behold Our God',
    russianTitle: 'Вот наш Бог',
    author: 'Jonathan Baird, Meghan Baird, Ryan Baird, and Stephen Altrogge',
    authors: ['Jonathan Baird', 'Meghan Baird', 'Ryan Baird', 'Stephen Altrogge'],
    year: 2011,
    description: 'A modern Sovereign Grace song.',
    rightsLabel: 'Copyrighted words and music © 2011 Sovereign Grace Worship. Heritage includes only the catalog record.',
    sourceUrl: 'https://sovereigngracemusic.com/music/songs/behold-our-god/',
    permissionUrl: 'https://sovereigngracemusic.com/about/permissions/',
  }),
  catalogOnlySong({
    id: 'christ-our-hope',
    title: 'Christ Our Hope in Life and Death',
    russianTitle: 'Во Христе — надежды свет',
    author: 'Keith Getty, Matt Boswell, Jordan Kauflin, Matt Merker, and Matt Papa',
    authors: ['Keith Getty', 'Matt Boswell', 'Jordan Kauflin', 'Matt Merker', 'Matt Papa'],
    year: 2020,
    description: 'A modern hymn based on the first question of the Heidelberg Catechism.',
    rightsLabel: 'Copyrighted words and music © 2020 Getty Music and associated publishers. Heritage includes only the catalog record.',
    sourceUrl: 'https://www.gettymusic.com/christ-our-hope-in-life-and-death',
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
    russianStanzas: [
      `Приди, Источник всех даров,
Настрой мой дух хвалить Тебя;
Потоки милости текут,
И песнь хвалы не умолкает.
Научи небесной песне,
Что звучит пред Твоим престолом;
Славлю гору искупления,
Гору неизменной любви.`,
      `Здесь я ставлю камень памяти:
До сих пор Ты вёл меня;
И надеюсь, по Твоей благости,
Безопасно прийти домой.
Иисус нашёл меня чужим,
Когда я от стада блуждал;
Чтоб спасти меня от гибели,
Он пролил Свою кровь.`,
      `Как велик мой долг пред милостью,
Что хранит меня изо дня в день!
Пусть Твоя благость, словно цепь,
Привяжет сердце к Тебе.
Я склонен странствовать, Господь,
Склонен оставить Того, Кого люблю;
Вот моё сердце — возьми и запечатай
Для Твоих небесных дворов.`,
    ],
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
  catalogOnlySong({
    id: 'grace-alone',
    title: 'Grace Alone',
    russianTitle: 'Только благодать',
    author: 'Dustin Kensrue',
    authors: ['Dustin Kensrue'],
    year: 2012,
    description: 'The modern song recorded by The Modern Post; this is not a traditional public-domain hymn.',
    rightsLabel: 'Modern copyrighted words and music. Heritage includes only the catalog record until a Community records its authorized edition.',
    sourceUrl: 'https://www.worshiptogether.com/songs/grace-alone-the-modern-post/',
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
  catalogOnlySong({
    id: 'his-mercy-is-more',
    title: 'His Mercy Is More',
    russianTitle: 'Его милость сильней',
    author: 'Matt Boswell and Matt Papa',
    authors: ['Matt Boswell', 'Matt Papa'],
    year: 2016,
    description: 'A modern hymn by Matt Boswell and Matt Papa.',
    rightsLabel: 'Copyrighted words and music. Heritage includes only the catalog record.',
    sourceUrl: 'https://sovereigngracemusic.com/music/songs/his-mercy-is-more/',
    permissionUrl: 'https://sovereigngracemusic.com/about/permissions/',
  }),
  catalogOnlySong({
    id: 'how-great-thou-art',
    title: 'How Great Thou Art',
    russianTitle: 'Великий Бог, когда на мир смотрю я',
    author: 'Stuart K. Hine',
    authors: ['Stuart K. Hine'],
    year: 1949,
    description: 'Stuart Hine’s English version remains copyrighted despite older source material.',
    rightsLabel: 'The official rights holder states that the English song remains copyrighted until March 2059. Heritage includes only metadata.',
    sourceUrl: 'https://howgreatthouartofficial.com/',
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
    russianStanzas: [
      `Когда мир, словно река, окружает мой путь,
Или скорби, как море, бушуют,
При всякой судьбе Ты учишь сказать:
Мир душе, мир душе моей.`,
      `Пусть сатана нападает и испытания придут,
Одно заверение мной управляет:
Христос увидел мою беспомощность
И пролил за мою душу Свою кровь.`,
      `Мой грех — о радость этой славной мысли! —
Не часть, но весь до конца,
Пригвождён ко кресту, и я больше не несу его.
Слава Господу, душа моя!`,
      `Господь, приблизь день, когда вера станет зрением,
И небеса свернутся, словно свиток;
Труба прозвучит, и Господь сойдёт —
И тогда мир душе моей.`,
    ],
  }),
  catalogOnlySong({
    id: 'jesus-no-one-like-you',
    title: 'Jesus, There’s No One Like You',
    russianTitle: 'Иисус, нет подобного Тебе',
    author: 'Sovereign Grace Music',
    authors: [],
    year: 2019,
    description: 'A modern Sovereign Grace song.',
    rightsLabel: 'Modern copyrighted words and music. Heritage includes only the catalog record.',
    sourceUrl: 'https://sovereigngracemusic.com/music/songs/jesus-theres-no-one-like-you/',
    permissionUrl: 'https://sovereigngracemusic.com/about/permissions/',
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
  catalogOnlySong({
    id: 'my-redeemers-love',
    title: 'My Redeemer’s Love',
    russianTitle: 'Любовь Искупителя',
    author: 'Mark Altrogge',
    authors: ['Mark Altrogge'],
    year: 2012,
    description: 'A modern Sovereign Grace song.',
    rightsLabel: 'Copyrighted words and music © 2012 Sovereign Grace Praise. Heritage includes only the catalog record.',
    sourceUrl: 'https://sovereigngracemusic.com/music/songs/my-redeemers-love/',
    permissionUrl: 'https://sovereigngracemusic.com/about/permissions/',
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
  catalogOnlySong({
    id: 'o-church-arise',
    title: 'O Church, Arise',
    russianTitle: 'О Церковь, встань',
    author: 'Keith Getty and Stuart Townend',
    authors: ['Keith Getty', 'Stuart Townend'],
    year: 2004,
    description: 'A modern Getty/Townend hymn.',
    rightsLabel: 'Copyrighted words and music © 2004 Thankyou Music. Heritage includes only the catalog record.',
    sourceUrl: 'https://www.gettymusic.com/o-church-arise',
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
  catalogOnlySong({
    id: 'yet-not-i',
    title: 'Yet Not I, But Through Christ in Me',
    russianTitle: 'Не я, но Христос во мне',
    author: 'CityAlight',
    authors: ['Jonny Robinson', 'Rich Thompson', 'Michael Farren'],
    year: 2018,
    description: 'A modern CityAlight hymn.',
    rightsLabel: 'Copyrighted words and music. Heritage includes only the catalog record.',
    sourceUrl: 'https://cityalight.com/song/yet-not-i-but-through-christ-in-me/',
  }),
  catalogOnlySong({
    id: 'ten-thousand-reasons',
    title: '10,000 Reasons (Bless the Lord)',
    russianTitle: 'Десять тысяч причин',
    author: 'Matt Redman and Jonas Myrin',
    authors: ['Matt Redman', 'Jonas Myrin'],
    year: 2011,
    description: 'A modern worship song.',
    rightsLabel: 'Copyrighted words and music; CCLI Song No. 6016351. Heritage includes only the catalog record.',
    sourceUrl: 'https://www.worshiptogether.com/songs/10000-reasons-bless-the-lord-matt-redman/',
  }),
]
