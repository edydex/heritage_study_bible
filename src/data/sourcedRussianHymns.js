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

// A deliberately small built-in selection. Both texts are established hymn
// editions with traceable sources; do not add generated translations here.
export const SOURCED_RUSSIAN_HYMNS = {
  'amazing-grace': sourcedRussianHymn({
    title: 'О, благодать',
    sourceLabel: 'Hymnary Russian text authority; translator listed as anonymous',
    sourceUrl: 'https://hymnary.org/text/o_blagodat',
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

  'rock-of-ages': sourcedRussianHymn({
    title: 'Благодатная скала',
    sourceLabel: 'Песнь возрождения, no. 216; translation by Ivan S. Prokhanov',
    sourceUrl: 'https://noty.propovednik.com/Public/_PV_A_Epp/Daten/216.pdf',
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
}
