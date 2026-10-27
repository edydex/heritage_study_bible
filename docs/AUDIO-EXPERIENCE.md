# Listening and quick navigation

Tap the reader's chapter title to choose a chapter. Hold it to open an upper
half-wheel anchored at the held title, slide upward toward a section, and
release. Every destination stays above the finger; the fan does not move its
center higher up the screen. Releasing without selecting
keeps the wheel open for tapping. The wheel is available in the Bible and book
readers; Escape, Android Back, the center button, or tapping outside dismisses it.
Keyboard users can open it with Shift+Enter and use arrows or Tab.

On Android, scrolling down hides both the status bar and the system navigation
bar, including three-button navigation, with the reader's header. Scrolling up,
opening reader settings or leaving the reader restores them. An edge swipe can
temporarily reveal the system controls while reading, following Android's
[immersive-mode behavior](https://developer.android.com/develop/ui/views/layout/immersive).

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

Cold car acceptance uses a visible, trusted controller activity in the test APK,
under a different UID from Heritage, while the reader stays closed. Android 15 deliberately
omits media-session user-interaction exemptions for a controller calling its own
UID. A background self-controller therefore cannot stand in for Android Auto:
it can load the saved recording but its audio-focus request is rejected. The
separate test host exercises the platform's external-controller path and retains
the actual playing, saved-position, pause, replay and no-autoplay assertions.
The disposable-emulator runner enables the test host's empty notification-listener
component to obtain the platform's trusted-controller status, as Android Auto
does. Media3 1.11 gives untrusted external controllers read-only defaults. The host
asserts its trust, visible state and distinct UID before dispatching commands.
The fixture contains no notification-payload handling, is absent from the installed
reader APK, and changes no production permission or audio-focus policy. Physical
device tests do not automatically grant this test-host access.
See the pinned Android 15
[media-session allowlist implementation](https://android.googlesource.com/platform/frameworks/base/+/refs/tags/android-15.0.0_r1/services/core/java/com/android/server/media/MediaSessionService.java)
and [audio-focus guidance](https://developer.android.com/media/optimize/audio-focus),
plus [Media3 controller defaults](https://developer.android.com/reference/androidx/media3/session/MediaSession.ConnectionResult.AcceptedResultBuilder).
