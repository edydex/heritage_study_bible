function section(label, text) {
  return {
    label,
    lines: text.trim().split('\n'),
  }
}

function sourcedRussianHymn({
  title,
  sourceLabel,
  sourceUrl = '',
  rightsLabel,
  sections,
}) {
  return {
    title,
    sourceLabel,
    sourceUrl,
    rightsLabel,
    sections: sections.map(([label, text]) => section(label, text)),
  }
}

// These are established Russian hymn texts, not Heritage translations.
// Internet sources are limited to records that identify the text as public
// domain. The two WOTBC records came from service decks supplied by the user.
export const SOURCED_RUSSIAN_HYMNS = {
  'amazing-grace': sourcedRussianHymn({
    title: 'О, благодать',
    sourceLabel: 'Hymnary Russian text authority; translator listed as anonymous',
    sourceUrl: 'https://www.hymnary.org/text/o_blagodat',
    rightsLabel: 'Russian words: public domain. Hymnary lists the translator as anonymous.',
    sections: [
      ['Куплет 1', `О, Благодать,
Спасен Тобой я из пучины бед;
Был мертв и чудом стал живой,
Был слеп и вижу свет.`],
      ['Куплет 2', `Сперва внушила сердцу страх,
Затем — дала покой.
Я скорбь души излил в слезах,
Твой мир течет рекой.`],
      ['Куплет 3', `Прошел немало я скорбей,
Невзгод и черных дней,
Но ты всегда была со мной,
Ведёшь меня домой.`],
      ['Куплет 4', `Словам Господним верю я,
Моя вся крепость в них:
Он — верный щит, Он — часть моя
Во всех путях моих.`],
      ['Куплет 5', `Когда же плоть моя умрет,
Придет борьбе конец,
Меня в небесном доме ждет
И радость, и венец.`],
      ['Куплет 6', `Пройдут десятки тысяч лет,
Забудем смерти тень,
А Богу также будем петь,
Как в самый первый день.`],
    ],
  }),

  'jesus-paid-it-all': sourcedRussianHymn({
    title: 'Я слышу со Креста',
    sourceLabel: 'Гимны христиан (1994), no. 138; translation by D. A. Jasko',
    sourceUrl: 'https://library.timelesstruths.org/music/Jesus_Paid_It_All%40ru.pdf',
    rightsLabel: 'Russian words: translation by D. A. Jasko. The linked score identifies the source edition and marks the text public domain.',
    sections: [
      ['Куплет 1', `Я слышу со Креста,
Спаситель говорит:
«Ты грешен, за тебя
Я ко Кресту прибит».`],
      ['Припев', `Долг мой уплатил
Любящий Иисус.
Своей кровью искупил,
Я только Им хвалюсь.`],
      ['Куплет 2', `Господь, Твоя рука
Всё может совершить:
Сокрушить ярмо греха
И все раны исцелить.`],
      ['Куплет 3', `Я недостоин жить
С Христом на высоте.
Но мой грех с меня омыт
Кровью Агнца на Кресте.`],
      ['Куплет 4', `Когда же в оный день
Перед Творцом явлюсь,
Буду повторять везде:
«Умер за меня Иисус».`],
    ],
  }),

  'come-thou-fount': sourcedRussianHymn({
    title: 'Дух Святой, Дух благодати',
    sourceLabel: 'Гимны христиан and Песнь возрождения; D. A. Jasko translation (verses 1–3)',
    sourceUrl: 'https://library.timelesstruths.org/music/Come_Thou_Fount_of_Every_Blessing%40ru.pdf',
    rightsLabel: 'Russian words: D. A. Jasko (verses 1–3) and the linked source’s fourth-verse edition. The linked score marks the text public domain.',
    sections: [
      ['Куплет 1', `Дух Святой, Дух благодати,
К нам приди в любви святой
И сердца сюда пришедших
К пенью дружному настрой.
Научи нас петь ту песню,
Что поют на высоте
Хоры ангелов небесных
О Спасителе Христе.`],
      ['Куплет 2', `Здесь мы ставим Авен-Езер:
Ты доселе нам помог.
И вовеки будь к нам близок,
Сохрани в нас Твой залог.
Мы блуждали в мире этом,
Но Спаситель нас взыскал,
Озарил небесным светом,
На Голгофе оправдал.`],
      ['Куплет 3', `О Господь, мы всей душою
Воздаём хвалу Тебе:
Благодатию святою
Ты приблизил нас к Себе;
Мы так склонны заблуждаться,
Свои стези избирать;
Ты на нас излей обильно,
Искупитель, благодать.`],
      ['Куплет 4', `Аллилуйя! О Спаситель,
Ты очистил нам сердца,
Как и обещал решившим
Жить с Тобой и для Тебя.
Дух Святой, Тобою данный,
На пути удержит нас;
Дай же нам Ему всецело
Доверять во всякий час.`],
    ],
  }),

  'i-surrender-all': sourcedRussianHymn({
    title: 'Всё Иисусу отдаю я',
    sourceLabel: 'Hymnary Russian text authority; translator listed as anonymous',
    sourceUrl: 'https://hymnary.org/text/vse_lisus_otdayu_ya',
    rightsLabel: 'Russian words: public domain. Hymnary lists the translator as anonymous.',
    sections: [
      ['Куплет 1', `Всё Иисусу отдаю я,
Весь Ему принадлежу;
В упованье и смиренье
Пред лицом Его хожу.`],
      ['Припев', `Всё я отдаю, всё я отдаю;
Всё Тебе, мой Искупитель,
Всё я отдаю.`],
      ['Куплет 2', `Всё Иисусу отдаю я,
Всё кладу к Его ногам.
Суету отверг земную,
Направляюсь к небесам.`],
      ['Куплет 3', `Всё Иисусу отдаю я,
Весь хочу Христовым быть.
Дух Предвечный да научит
Знать Христа, Христа любить.`],
      ['Куплет 4', `Всё Иисусу отдаю я.
Боже, храм во мне создай!
Благодатью и любовью
Ум и сердце наполняй.`],
      ['Куплет 5', `Всё Иисусу отдаю я.
Чудо Он во мне свершил:
Мир и радость дал святую.
Слава, слава Богу сил!`],
    ],
  }),

  'it-is-well': sourcedRussianHymn({
    title: 'Течёт ли жизнь мирно',
    sourceLabel: 'Russian public-domain score in the Timeless Truths archive',
    sourceUrl: 'https://library.timelesstruths.org/music/It_Is_Well_with_My_Soul%40ru.pdf',
    rightsLabel: 'Russian words: the linked hymn score identifies its source editions and marks the text public domain.',
    sections: [
      ['Куплет 1', `Течёт ли жизнь мирно, подобно реке,
Несусь ли на грозных волнах, —
Во всякое время, вблизи, вдалеке
В Твоих я покоюсь руках.`],
      ['Припев', `Ты со мной, мой Господь,
Ты со мной, мой Господь,
В Твоих я покоюсь руках.`],
      ['Куплет 2', `Ни вражьи нападки, ни тяжесть скорбей
Не склонят меня позабыть,
Что Бог мой меня из пучины страстей
В любви восхотел искупить.`],
      ['Куплет 3', `Что в мире сравнится с усладой такой?
Мой грех весь, как есть, целиком,
К кресту пригвождён, и я кровью святой
Искуплен всесильным Христом.`],
      ['Куплет 4', `От сердца скажу: «Для меня жизнь — Христос»,
И в Нём мой всесильный оплот.
Следы от греха, искушений и слёз
С меня Он с любовью сотрёт.`],
      ['Куплет 5', `Господь! Твоего я пришествия жду;
Принять мою душу гряди!
Я знаю, тогда лишь вполне я найду
Покой у Тебя на груди.`],
    ],
  }),

  'just-as-i-am': sourcedRussianHymn({
    title: 'Таков, как есмь',
    sourceLabel: 'Песнь возрождения; anonymous Russian translation published in 1902',
    sourceUrl: 'https://ru.wikisource.org/wiki/Таков,_как_есмь/ПВ3055_(СО)',
    rightsLabel: 'Russian words: anonymous translation published in 1902. The source identifies the text as public domain in the United States.',
    sections: [
      ['Куплет 1', `Таков как есмь, во имя Крови,
За нас пролитой на кресте,
Во имя Божьих призываний,
Христос, я прихожу к Тебе!`],
      ['Куплет 2', `Таков как есмь, слепой и бедный,
Добра не находя в себе,
За верой, зреньем и прощеньем,
Христос, я прихожу к Тебе!`],
      ['Куплет 3', `Таков как есмь, меня Ты примешь,
Дашь жизнь, спасенье, мир Твой мне;
К Тебе я прихожу, Спаситель,
Дай мне Тебя познать вполне!`],
      ['Куплет 4', `Таков как есмь, Твоей любовью
Низвергнул Ты преграды все,
Я Твой отныне и вовеки, —
Христос, я прихожу к Тебе!`],
    ],
  }),

  'nothing-but-the-blood': sourcedRussianHymn({
    title: 'Что вину мне может смыть?',
    sourceLabel: 'Hymnary Russian text authority; translator listed as anonymous',
    sourceUrl: 'https://hymnary.org/text/chto_vinu_mne_mozhet_smyt',
    rightsLabel: 'Russian words: public domain. Hymnary lists the translator as anonymous.',
    sections: [
      ['Куплет 1', `Что вину мне может смыть?
О, ничто, лишь кровь Иисуса!
Вновь что может исцелить?
О, ничто, лишь кровь Иисуса!`],
      ['Припев', `Как дорога струя,
Омывшая меня!
Она сильней морей:
О, ничто, лишь кровь Иисуса!`],
      ['Куплет 2', `Чтоб очиститься, гляжу
Лишь на кровь одну Иисуса.
Дар прощенья нахожу
Лишь в крови святой Иисуса.`],
      ['Куплет 3', `От греха искупит дух —
О, ничто, лишь кровь Иисуса;
Ни добро моих заслуг —
О, ничто, лишь кровь Иисуса!`],
      ['Куплет 4', `Мир, надежду мне дарит —
О, ничто, лишь кровь Иисуса!
Моя святость мне не щит —
О, ничто, лишь кровь Иисуса!`],
    ],
  }),

  'o-come-o-come-emmanuel': sourcedRussianHymn({
    title: 'Приди, приди, Эммануил',
    sourceLabel: 'Гимны христиан (1994), no. 103; D. A. Jasko translation',
    sourceUrl: 'https://library.timelesstruths.org/music/O_Come_O_Come_Emmanuel%40ru.pdf',
    rightsLabel: 'Russian words: D. A. Jasko translation. The linked score identifies the source edition and marks the text public domain.',
    sections: [
      ['Куплет 1', `Приди, приди, Эммануил!
Спаси от власти тёмных сил
В неволе страждущий народ,
Что терпит, молится и ждёт.`],
      ['Припев', `Ликуй! Ликуй! Эммануил
Спасёт народ от вражьих сил.`],
      ['Куплет 2', `Приди, Господь, как на Синай.
Своё величье покажи,
Твою нам волю открывай,
В сердцах и мыслях напиши.`],
      ['Куплет 3', `Приди, Жезл Иессея, вновь,
Освободи греха рабов,
Из моря зла спаси людей,
На всех Дух истины излей!`],
      ['Куплет 4', `Приди, Звезда, обрадуй нас,
Что близок, близок славный час;
Избавь от всяких бурь и бед,
Тьму прогони, пошли Твой свет.`],
      ['Куплет 5', `Приди, Давида Ключ святой,
Нам двери в Царствие открой;
Чтоб враг нам смертью не грозил,
Приди, приди, Эммануил!`],
    ],
  }),

  'rock-of-ages': sourcedRussianHymn({
    title: 'Благодатная скала',
    sourceLabel: 'Песнь возрождения; translation by Ivan S. Prokhanov, published in 1902',
    sourceUrl: 'https://ru.wikisource.org/wiki/Благодатная_скала/ПВ3055_(СО)',
    rightsLabel: 'Russian words: Ivan S. Prokhanov translation published in 1902; public-domain text.',
    sections: [
      ['Куплет 1', `Благодатная скала
Мне спасение даёт;
От греха, порока, зла
Я в ней вижу свой оплот.
Из скалы Христа струёй
Льётся ток воды живой.`],
      ['Куплет 2', `Я не мог соблюсть закон
И был к смерти осуждён.
Грех преследовал меня,
Сердце жёг сильней огня.
И я мог найти покой
Лишь в скале Христа святой.`],
      ['Куплет 3', `Я пришёл к Тебе, мой Бог!
Я был наг, и Ты одел;
Я был беден, Ты в удел
Дал мне дивный Твой чертог;
Ты омыл меня в Крови,
Я сокрыт в скале любви.`],
      ['Куплет 4', `Благодатный Божий свет
Оградил меня от бед;
Среди горя и невзгод
Он мне силу подаёт.
Никого я не страшусь:
Ввек со мной скала — Иисус!`],
    ],
  }),

  'turn-your-eyes': sourcedRussianHymn({
    title: 'Обрати взор к Иисусу',
    sourceLabel: 'Russian public-domain score in the Timeless Truths archive',
    sourceUrl: 'https://library.timelesstruths.org/music/Turn_Your_Eyes_upon_Jesus%40ru.pdf',
    rightsLabel: 'Russian words: the linked score identifies the source edition and marks the text public domain.',
    sections: [
      ['Куплет 1', `Душа, ты в тоске и смятенье,
Не можешь идти в темноте?
Взгляни, во Христе свет, прозренье,
Свобода и жизнь в полноте.`],
      ['Припев', `Обрати взор к Иисусу,
Вглядись в восхитительный лик,
И померкнет вмиг мира красота
При лучах благодати Христа.`],
      ['Куплет 2', `Идём за Иисусом в обитель,
От смерти Он в жизнь перешёл.
Я более, чем победитель —
Разрушен греховный престол.`],
      ['Куплет 3', `Он Слово Своё исполняет,
Лишь верь, хорошо будет с Ним;
О друг, этот мир умирает,
Неси весть спасенья другим.`],
    ],
  }),

  'what-a-friend': sourcedRussianHymn({
    title: 'Что за Друга мы имеем',
    sourceLabel: 'Hymnary Russian text authority; translator listed as anonymous',
    sourceUrl: 'https://hymnary.org/text/chto_za_druga_my_imeyem',
    rightsLabel: 'Russian words: public domain. Hymnary lists the translator as anonymous.',
    sections: [
      ['Куплет 1', `Что за Друга мы имеем?
Нас Он к жизни пробудил,
В Нём мы счастием владеем,
В Нём источник вечных сил.
Ах, как часто мы страдали,
Боль терпя напрасно там,
Где просить мы забывали,
Чтоб один помог Он нам.`],
      ['Куплет 2', `Искушенье ль нас тревожит,
Жизнь печальна ли у кого,
Каждый пусть из нас возложит
Скорбь свою всю на Него.
Он один среди вселенной
Может свет средь тьмы пролить;
Лишь Христос один мгновенно
Может горе облегчить.`],
      ['Куплет 3', `Изнываем мы под зноем
Этой жизни суетной;
Сердце лишь Ему откроем,
И Он даст душе покой.
Если нас друзья забыли,
Скажем Господу о том,
И Христос проявит в силе,
Что Он верный Друг во всём.`],
    ],
  }),
}
