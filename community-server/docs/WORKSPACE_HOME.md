# Workspace home and song creation

Home continues the last accessible active service opened on this browser by the
signed-in manager, scoped to their account and church. If that local preference
is unavailable, it uses the most recently edited active service. Archived,
cancelled and inaccessible services are excluded. Other recent services exclude
the continued service and are limited to three rows. No new server-side tracking
of document content or navigation URLs is added.

New service opens the planner's creation form. Add a song opens the song library's
existing form, which also accepts PowerPoint import. Prepare a sermon opens its
existing preparation workflow. Library, sermon publication and translation links are secondary;
recent workspace activity stays collapsed below them. Home includes loading,
empty, failed-load and disabled-browser-storage states.

The planner accepts a `service` query parameter only when it matches an authorized
service summary. Normal API authorization still governs opening the document.
Sign-in preserves that selection or the explicit new-service form.

The song picker always offers Create a song after results, including empty
searches and language filters. In the web planner it opens Payload's existing
song form in its document drawer, retaining the service and picker. Save refreshes
the song list, removes the old filter and selects the created song. Adding it to
the service remains a separate explicit action. Cancel leaves the service intact.
Embedded editors without Payload context use a separate song-library tab and the
existing Refresh library action; their service draft stays open.

The paid Muse critique informed duplicate-free recents, a persistent picker
creation action, and reuse of the existing song form. No new analytics provider
or UI-generation dependency is required at runtime.
