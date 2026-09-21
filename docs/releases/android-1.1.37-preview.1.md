# Heritage 1.1.37-preview.1

Android versionCode 40. Install over the existing Heritage app to retain your data.

- Share song opens a popup with **Link copied**, the selectable link, and a QR code generated on the device. If clipboard access is blocked, the popup offers manual copying without claiming success. Member-only song links still require church sign-in.
- Calendar events open their own details pages, with start/end times, location, description and the optional registration website. Event links support reload and returning to the calendar. Add-to-calendar and member RSVP actions remain available in Heritage.
- Legacy Pacific time-zone abbreviations are normalized to America/Los_Angeles. This fixes the Firefox crash when opening an event saved with PST, while retaining Pacific daylight-saving behavior.
- The matching Community update labels the optional URL as **Registration or event website (optional)**, explains that event pages are created automatically, and shows invalid values as field errors instead of a generic server failure.

Verification includes 32 Chromium/Firefox browser scenarios, decoding the actual displayed QR code, 225 reader unit tests, 124 protocol tests, and calendar/DST tests. Physical-phone acceptance remains separate from automated checks.
