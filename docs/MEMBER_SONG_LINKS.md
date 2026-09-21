# Member song links

Church song sharing uses an explicit member route:

`/#/community-song?access=member&server=<content-server-id>&url=<encoded-song-url>`

The recipient must have joined that church and signed in on the current device. Personal notes/progress sync alone does not grant membership. The reader loads the existing asynchronous secure session, validates its issuer, and sends the member header only to the saved Community content origin. Requests carrying that header reject redirects. The route contains no session credential. Old ambiguous `?url=` links are rejected instead of being described as public access.

The church server remains authoritative for which song revision is available to members. Reviewed anonymous links at the church's `/community/songs/shared/<id>` path remain separate; the reader does not turn a member song into a public link or change its publication settings.

The member viewer supports the published English/Russian text and an explicit **Save offline** action. Saved copies are scoped to the current Community origin and sign-in using a non-reversible cache-name digest; they do not share the generic public-resource cache. A network interruption may use a saved copy for that same sign-in. A `401`, `403`, `404` or `410` response removes the saved song response and is shown as an access failure. Signing in again creates a new cache scope, so the song must be saved again. Offline mode cannot learn about a server-side access change until the server can be reached.

Browser acceptance covers successful member access, signed-out links without a protected content request, blocked redirects, same-session offline reading, separation after a session change and refusal to use a saved copy after a church access denial. These use synthetic accounts and songs; real church publication and manager approval remain separate acceptance work.
