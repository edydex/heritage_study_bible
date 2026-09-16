# Heritage 1.1.35-preview.1

Android versionCode 38. Install over the existing app to retain notes, progress, saved songs and church connections.

- Calendar opens from its own Community resource button, immediately before Sermons, instead of filling Community Home.
- Multi-day events use one continuous bar within each week. Events crossing a week boundary continue on the next row; selecting a middle date shows the ongoing event. Church time zones and exclusive midnight end times are preserved.
- Song readers interpret standalone `^1` / `^2` cues as verse headings and `---` slide breaks as paragraph spacing. English and Russian words are separated into readable verses without changing church source lyrics or clearing saved songs.
- The built-in Russian selection is reduced to two established texts: “О, благодать” and “Благодатная скала.” Church-managed versions remain separate and available as published by the church. No lyrics were generated for this update.

Text sources: [Hymnary’s Russian Amazing Grace text](https://hymnary.org/text/o_blagodat) and [Песнь возрождения no. 216, with the credited Prokhanov translation](https://noty.propovednik.com/Public/_PV_A_Epp/Daten/216.pdf). Source links remain available with the songs.

The matching Community server update adds `/calendar`, places Calendar before Sermons in public navigation, and uses the shared spanning calendar and lyric renderer. The admin calendar retains event creation/editing and existing privacy filters.

Local verification: 225 reader unit tests, 124 protocol tests, four Community calendar/time-zone tests, Community TypeScript and production build, plus browser checks at desktop and 390px phone widths. Physical-phone and church-device acceptance remain separate from these checks.
