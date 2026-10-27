# Listening and quick navigation

Tap the reader's chapter title to choose a chapter. Hold it to open the
navigation wheel, slide to a section, and release. Releasing without selecting
keeps the wheel open for tapping. The wheel is available in the Bible and book
readers; Escape, Android Back, the center button, or tapping outside dismisses it.
Keyboard users can open it with Shift+Enter and use arrows or Tab.

The audiobook library offers several recently listened books, each with its own
chapter, position, resume button, progress bar and remaining listening time.
Remaining time reflects playback speed. The library also filters in-progress and
finished titles. Each book's chapter list retains its saved chapter positions.
Returning to an earlier chapter moves that book's current cursor; the displayed
percentage describes the cursor in the title, not proof of listening to every
preceding chapter. Older progress without timestamps keeps the active chapter
and uses the last saved chapter for other books until they are played again.

The design uses the useful parts of Audible's experience: a recent-listens list,
chapter selection, simple playback controls, and visible remaining time. It
omits account commerce, recommendations, clips and social features. References:
[Audible's player documentation](https://help.audible.com/s/article/listen-in-the-app?language=en_US)
and [car listening guide](https://help.audible.com/s/article/listen-in-the-car?language=en_US).
The signed-in Android app was also inspected on the user's authorized phone.

## Android Auto

Heritage exposes Continue listening, Audiobooks, Bible and Downloads through its
native media library. Continue listening has one resumable chapter per book,
ordered by recent listening, with completion information for the car display.
The phone and car share the same playback owner and saved progress.

Connecting restores the last recording's queue, position and speed and prepares
it while paused, so Android Auto can expose its player. It never starts playback. The car's explicit Play starts or resumes it. Android Auto
may send its own Play command according to its “Start music automatically”
setting; Heritage never issues Play merely because a browser connects. With no
saved recording, explicit Play displays a hint to choose Audiobooks or Bible.
The car can browse and select a recording immediately afterward.

The implementation follows Android's
[playback and resumption guidance](https://developer.android.com/training/cars/media/enable-playback)
and [Media3 session contract](https://developer.android.com/media/media3/session/background-playback).
Testing uses both real legacy media controllers on a phone and Google's
[Desktop Head Unit](https://developer.android.com/training/cars/testing/dhu).
Those checks cover the tested phone/simulator; physical car hardware is separate.
