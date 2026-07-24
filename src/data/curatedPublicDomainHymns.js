function section(label, text) {
  return {
    label,
    lines: text.trim().split('\n'),
  }
}

function hymn(englishSections, russianSections) {
  return {
    sections: englishSections.map(([label, text]) => section(label, text)),
    russianSections: russianSections.map(([label, text]) => section(label, text)),
  }
}

// English entries below are transcribed from the public-domain sources linked
// on their Heritage catalog records. Russian entries are new Heritage drafts
// translated directly from those English texts, not copied from a hymnal.
export const CURATED_PUBLIC_DOMAIN_HYMNS = {
  'fairest-lord-jesus': hymn([], [
    ['Куплет 1', `Прекрасный Иисус, Владыка природы,
Сын Бога и Сын Человеческий!
Тебя я люблю, Тебя почитаю;
Ты — слава, радость и венец души.`],
    ['Куплет 2', `Прекрасны луга, прекраснее рощи,
Одетые весною в цветы;
Иисус прекраснее, Иисус чище —
Он скорбное сердце учит петь.`],
    ['Куплет 3', `Прекрасно солнце, прекраснее луна
И весь мерцающий звёздный сонм;
Иисус сияет ярче, Иисус чище
Всех ангелов, которыми хвалится небо.`],
    ['Куплет 4', `Прекрасный Спаситель, Господь всех народов,
Сын Бога и Сын Человеческий!
Слава и честь, хвала и поклонение
Ныне и вечно да будут Тебе.`],
  ]),

  'give-me-jesus': hymn([
    ['Verse 1', `In the morning when I rise,
In the morning when I rise,
In the morning when I rise,
Give me Jesus.`],
    ['Refrain', `Give me Jesus,
Give me Jesus.
You may have all the rest,
Give me Jesus.`],
    ['Verse 2', `Dark midnight was my cry,
Dark midnight was my cry,
Dark midnight was my cry,
Give me Jesus.`],
    ['Verse 3', `Just about the break of day,
Just about the break of day,
Just about the break of day,
Give me Jesus.`],
    ['Verse 4', `Oh, when I come to die,
Oh, when I come to die,
Oh, when I come to die,
Give me Jesus.`],
    ['Verse 5', `And when I want to sing,
And when I want to sing,
And when I want to sing,
Give me Jesus.`],
  ], [
    ['Куплет 1', `Когда утром я встаю,
Когда утром я встаю,
Когда утром я встаю —
Дай мне Иисуса.`],
    ['Припев', `Дай мне Иисуса,
Дай мне Иисуса.
Пусть другим достанется весь мир —
Дай мне Иисуса.`],
    ['Куплет 2', `В полночь тёмную молюсь,
В полночь тёмную молюсь,
В полночь тёмную молюсь —
Дай мне Иисуса.`],
    ['Куплет 3', `Когда близится рассвет,
Когда близится рассвет,
Когда близится рассвет —
Дай мне Иисуса.`],
    ['Куплет 4', `И когда придёт мой час,
И когда придёт мой час,
И когда придёт мой час —
Дай мне Иисуса.`],
    ['Куплет 5', `И когда хочу я петь,
И когда хочу я петь,
И когда хочу я петь —
Дай мне Иисуса.`],
  ]),

  'he-will-hold-me-fast': hymn([
    ['Verse 1', `When I fear my faith will fail,
Christ will hold me fast;
When the tempter would prevail,
He can hold me fast.`],
    ['Refrain', `He will hold me fast,
He will hold me fast;
For my Savior loves me so,
He will hold me fast.`],
    ['Verse 2', `I could never keep my hold,
He must hold me fast;
For my love is often cold,
He must hold me fast.`],
    ['Verse 3', `I am precious in His sight,
He will hold me fast;
Those He saves are His delight,
He will hold me fast.`],
    ['Verse 4', `He’ll not let my soul be lost,
Christ will hold me fast;
Bought by Him at such a cost,
He will hold me fast.`],
  ], [
    ['Куплет 1', `Если вера ослабеет,
Он удержит меня;
Если враг одолеть посмеет,
Он удержит меня.`],
    ['Припев', `Он удержит меня,
Он удержит меня;
Так Спаситель любит меня —
Он удержит меня.`],
    ['Куплет 2', `Сам держаться не могу —
Он удержит меня;
Холодеет любовь моя —
Он удержит меня.`],
    ['Куплет 3', `Драгоценен я в Его глазах —
Он удержит меня;
В спасённых радость Его —
Он удержит меня.`],
    ['Куплет 4', `Не позволит душе погибнуть —
Он удержит меня;
Дорогой ценой я куплен Им —
Он удержит меня.`],
  ]),

  'i-know-my-redeemer-lives': hymn([
    ['Verse 1', `I know that my Redeemer lives!
What comfort this sweet sentence gives!
He lives, He lives, who once was dead;
He lives—my ever-living Head.`],
    ['Verse 2', `He lives to bless me with His love;
He lives to plead for me above;
He lives my hungry soul to feed;
He lives to help in time of need.`],
    ['Verse 3', `He lives and grants me daily breath;
He lives, and I shall conquer death;
He lives my mansion to prepare—
He lives to bring me safely there.`],
    ['Verse 4', `He lives—all glory to His name!
He lives—my Jesus, still the same;
Oh, the sweet joy this sentence gives:
I know that my Redeemer lives!`],
  ], [
    ['Куплет 1', `Я знаю: Искупитель жив!
Как утешает этот зов!
Он жив — Тот, Кто был мёртв за нас;
Он жив — Глава моя вовек.`],
    ['Куплет 2', `Он жив, чтоб милостью благословлять;
Он жив, чтоб за меня ходатайствовать;
Он жив, чтоб душу насыщать;
Он жив, чтоб в нужде помогать.`],
    ['Куплет 3', `Он жив и каждый вдох мне даёт;
Он жив — и смерть я побежду;
Он жив, готовит мне обитель;
Он жив и приведёт меня туда.`],
    ['Куплет 4', `Он жив — вся слава имени Его!
Он жив — Иисус мой неизменен;
Как сладко сердцу повторять:
Я знаю: Искупитель жив!`],
  ]),

  'i-surrender-all': hymn([], [
    ['Куплет 1', `Всё Иисусу отдаю,
Всё Ему дарю свободно;
Буду верить и любить,
Жить всегда в Его присутствии.`],
    ['Куплет 2', `Всё Иисусу отдаю,
У Его колен склоняюсь;
Все мирские блага прочь —
Ты прими меня, Иисус.`],
    ['Куплет 3', `Всё Иисусу отдаю,
Господи, Тебе вручаюсь;
Наполняй любовью, силой,
Благословение пошли.`],
    ['Припев', `Всё Тебе я отдаю,
Всё Тебе я отдаю;
Всё Тебе, благой Спаситель,
Всё Тебе я отдаю.`],
  ]),

  'just-as-i-am': hymn([
    ['Verse 1', `Just as I am, without one plea,
But that Thy blood was shed for me,
And that Thou bidst me come to Thee,
O Lamb of God, I come, I come.`],
    ['Verse 2', `Just as I am, and waiting not
To rid my soul of one dark blot,
To Thee whose blood can cleanse each spot,
O Lamb of God, I come, I come.`],
    ['Verse 3', `Just as I am, though tossed about
With many a conflict, many a doubt,
Fightings and fears within, without,
O Lamb of God, I come, I come.`],
    ['Verse 4', `Just as I am, poor, wretched, blind;
Sight, riches, healing of the mind,
Yea, all I need in Thee to find,
O Lamb of God, I come, I come.`],
    ['Verse 5', `Just as I am, Thou wilt receive,
Wilt welcome, pardon, cleanse, relieve;
Because Thy promise I believe,
O Lamb of God, I come, I come.`],
    ['Verse 6', `Just as I am, Thy love unknown
Hath broken every barrier down;
Now, to be Thine, yea, Thine alone,
O Lamb of God, I come, I come.`],
  ], [
    ['Куплет 1', `Таким, как есть, без слов в защиту,
Лишь веря: кровь Твоя пролита,
И слыша зов прийти к Тебе,
О Божий Агнец, я иду.`],
    ['Куплет 2', `Таким, как есть, не ожидая,
Пока исчезнет пятно греха,
К Тому, Чья кровь очистит всё,
О Божий Агнец, я иду.`],
    ['Куплет 3', `Таким, как есть, среди сомнений,
Борьбы и страхов вне, внутри,
К Тебе несу смятенье всё,
О Божий Агнец, я иду.`],
    ['Куплет 4', `Таким, как есть: нищ, слеп и слаб,
В Тебе найти хочу прозренье,
Богатство, исцеленье, всё —
О Божий Агнец, я иду.`],
    ['Куплет 5', `Таким, как есть; Ты примешь, встретишь,
Простишь, очистишь, укрепишь;
Я верю обещанью Твоему —
О Божий Агнец, я иду.`],
    ['Куплет 6', `Таким, как есть; Твоя любовь
Все преграды сокрушила;
Теперь Твоим быть навсегда —
О Божий Агнец, я иду.`],
  ]),

  'nothing-but-the-blood': hymn([], [
    ['Куплет 1', `Что смывает мой грех?
Только кровь Иисуса.
Что меня очистит вновь?
Только кровь Иисуса.`],
    ['Куплет 2', `В ней прощение моё —
Только кровь Иисуса.
Об очищении молюсь —
Только кровь Иисуса.`],
    ['Куплет 3', `Грех ничем не искупить —
Только кровью Иисуса.
Не спасут мои дела —
Только кровь Иисуса.`],
    ['Куплет 4', `В ней надежда и мой мир —
Только кровь Иисуса.
В ней вся праведность моя —
Только кровь Иисуса.`],
    ['Припев', `О, как драгоценен ток,
Белым делает, как снег;
Нет другого мне ключа —
Только кровь Иисуса.`],
  ]),

  'o-come-all-ye-faithful': hymn([
    ['Verse 1', `Oh, come, all ye faithful, joyful and triumphant,
Oh, come ye, oh, come ye, to Bethlehem.
Come and behold Him, born the King of angels;`],
    ['Refrain', `Oh, come, let us adore Him,
Oh, come, let us adore Him,
Oh, come, let us adore Him,
Christ the Lord.`],
    ['Verse 2', `Sing, choirs of angels, sing in exultation;
Oh, sing, all ye citizens of heav’n above!
Glory to God, all glory in the highest;`],
    ['Verse 3', `Yea, Lord, we greet Thee, born this happy morning;
Jesus, to Thee be all glory giv’n;
Word of the Father, now in flesh appearing;`],
  ], [
    ['Куплет 1', `Придите, все верные, с радостью победной,
Придите, придите в Вифлеем.
Взгляните на Рождённого — Царя ангелов.`],
    ['Припев', `Придём и поклонимся,
Придём и поклонимся,
Придём и поклонимся
Христу Господу.`],
    ['Куплет 2', `Пойте, хоры ангелов, пойте с ликованьем;
Пойте, все жители небес!
Слава Богу, вся слава в вышних.`],
    ['Куплет 3', `Да, Господь, встречаем Тебя, рождённого ныне;
Иисус, Тебе да будет вся слава;
Слово Отца теперь явилось во плоти.`],
  ]),

  'o-come-o-come-emmanuel': hymn([
    ['Verse 1', 'O come, O come, Emmanuel,\nAnd ransom captive Israel\nThat mourns in lonely exile here\nUntil the Son of God appear.'],
    ['Refrain', 'Rejoice! Rejoice! Emmanuel\nShall come to thee, O Israel.'],
  ], [
    ['Куплет 1', 'Приди, приди, Эммануил,\nИзбавь пленённый Израиль,\nЧто здесь в изгнании скорбит,\nПока Сын Божий не придёт.'],
    ['Припев', 'Ликуй! Ликуй! Эммануил\nПридёт к тебе, Израиль.'],
    ['Куплет 2', 'Приди, Заря, нас ободри,\nСвоим пришествием свети;\nРазвей ночные облака,\nПрогони смертную тень.'],
    ['Куплет 3', 'Приди, Давидов Ключ, открой\nНам путь широкий в вечный дом;\nДорогу к небу сохрани,\nА путь погибели закрой.'],
  ]),

  'o-my-soul-arise': hymn([], [
    ['Куплет 1', `Воспрянь, душа, воспрянь,
Отбрось вину и страх;
За нас закланная Жертва
Пред Богом предстоит;
Поручитель мой у трона,
Имя моё на Его руках.`],
    ['Куплет 2', `Он вечно жив вверху,
Чтоб за меня просить;
Любовь и кровь Его
О милости твердят;
Кровь за весь наш род пролита
И кропит престол благодати.`],
    ['Куплет 3', `Пять ран Он носит там,
Принятых на Голгофе;
Они за нас молят,
Они взывают мне:
«Отче, грешника прости
И искупленного не погуби».`],
    ['Куплет 4', `Отец молитву слышит
Возлюбленного Сына;
Он не отвернётся
От Сына Своего;
Дух свидетельствует кровью:
Я от Бога ныне рождён.`],
    ['Куплет 5', `Мой Бог примирён,
Я слышу голос прощения;
Он назвал меня дитём —
Мне больше нечего бояться;
С дерзновением иду
И взываю: «Авва, Отче!»`],
  ]),

  'rock-of-ages': hymn([], [
    ['Куплет 1', `Скала веков, рассечена,
Укрой меня внутри;
Пусть кровь и вода из Твоих ран
Исцелят меня от греха:
От вины его избавят
И разрушат власть его.`],
    ['Куплет 2', `Пусть бы слёзы вечно лились,
Пусть усердие не меркло —
Этим грех не искупить;
Только Ты способен спасти.
Без цены к Тебе иду,
За один Твой крест держусь.`],
    ['Куплет 3', `Пока длится краткий вдох,
И когда глаза закрою,
Когда встану в мир иной
И увижу Твой престол —
Скала веков, рассечена,
Дай укрыться мне в Тебе.`],
  ]),

  'turn-your-eyes': hymn([], [
    ['Куплет 1', `Душа, ты устала, тревожна?
Во тьме не находишь луча?
Взгляни на Спасителя верой —
В Нём жизнь изобильна, полна.`],
    ['Припев', `Обрати свой взор к Иисусу,
Всмотрись в Его дивный лик;
И всё на земле потускнеет
В сиянии славы и благодати Его.`],
    ['Куплет 2', `Сквозь смерть Он вошёл в жизнь вечную,
И вслед за Ним мы идём;
Грех больше над нами не властен —
Мы больше, чем победители в Нём.`],
    ['Куплет 3', `Слово Его не нарушится —
Поверь, и Он всё совершит;
Иди же к погибшему миру,
О полном спасении возвести.`],
  ]),

  'what-a-friend': hymn([], [
    ['Куплет 1', `Какой Друг нам дан в Иисусе —
Все грехи и скорби понесёт!
Как велико данное право:
Всё нести к Нему в молитве.
Сколько мира мы теряем,
Сколько боли зря несём —
Всё оттого, что не приносим
Кажду нужду Богу в молитве.`],
    ['Куплет 2', `Есть ли тяготы, искушенья?
Есть ли где-нибудь беда?
Нам не следует унывать —
Всё неси к Нему в молитве.
Есть ли друг вернее Иисуса,
Кто разделит всякую боль?
Он все слабости наши знает —
Всё неси к Нему в молитве.`],
    ['Куплет 3', `Мы устали и обременены,
Под заботой гнёмся мы?
Драгоценный наш Спаситель —
Всё неси к Нему в молитве.
Друзья презирают, оставляют?
Всё неси к Нему в молитве;
Он укроет в Своих объятиях —
Там найдёшь покой.`],
  ]),
}
