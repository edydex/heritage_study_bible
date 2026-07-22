# Self-hosting Heritage Community on a fresh Debian laptop

The guided installer is intended to turn a clean Debian headless machine into
a small church server without requiring the operator to know Docker,
PostgreSQL, reverse proxies, migrations, or systemd.

## What you need

- Debian 12 or 13, 64-bit, installed on an x86-64 or ARM64 machine.
- At least 4 GB RAM and 20 GB free disk space are recommended, together with
  stable Internet and permanent power. The installer warns below 3 GB of RAM
  plus swap or 10 GB free. More disk is needed for books, audio, video, and
  backups.
- For public hosting, a domain using Cloudflare DNS. The guided setup prints a
  web link that can be opened on another phone or computer; it then creates the
  tunnel and DNS record itself. This is not needed for local/SSH testing.
- SMTP details from an email provider: host, port, username, password, and a
  sender address. Public Communities use email links for member sign-in. SMTP
  may be skipped only for local/SSH testing, which disables member sign-in.
- An external disk or encrypted off-machine destination for a second copy of
  backups. A backup on the same laptop is convenient but is not disaster
  recovery.

The wizard cannot buy or register a domain, move nameservers to Cloudflare,
create an email-provider account, verify its sender, or publish
provider-specific SPF, DKIM, and DMARC records. Complete those account-level
steps first. The Cloudflare account must already show the domain as an active
DNS zone, and the SMTP provider must permit the sender address you enter.

Do **not** forward ports 3000 or 5432 on the router. PostgreSQL is never
published, the application listens only on `127.0.0.1`, and Cloudflare Tunnel
makes an outbound connection. Keep only the SSH access you already use to
administer Debian.

## The short path

Sign into the Debian machine over SSH, then run:

If `sudo` is unavailable (common when Debian was installed with a root
password), run `su -` first and execute the same commands as root without the
`sudo` prefixes.

```sh
sudo apt-get update
sudo apt-get install -y ca-certificates curl
curl -fsSL https://raw.githubusercontent.com/edydex/heritage_study_bible/main/community-server/deploy/bootstrap.sh \
  -o /tmp/heritage-community-bootstrap.sh
sed -n '1,220p' /tmp/heritage-community-bootstrap.sh
sudo bash /tmp/heritage-community-bootstrap.sh
```

Reading the downloaded bootstrap before running it is deliberate: it is the
only step that begins as code fetched from the Internet. The bootstrap installs
Git, clones the tracked repository into `/opt/heritage-community/app`, and
hands control to the full wizard.

The wizard asks for plain-language values and shows a non-secret summary before
changing the host. The normal path then:

1. checks Debian, architecture, systemd, disk space, and the chosen port;
2. installs Docker Engine and Compose from Docker's official Debian repository;
3. generates strong database and Payload secrets in a root-only file;
4. builds the locked application, starts PostgreSQL, and applies committed
   migrations;
5. creates the first system administrator, Community, and owner membership;
6. removes the one-time administrator password from server configuration after
   verifying the login;
7. when public hosting is selected, opens the Cloudflare authorization flow,
   creates DNS and a dedicated tunnel service, and verifies HTTPS;
8. when member sign-in is enabled, sends a real sign-in email through SMTP;
9. creates and verifies the first PostgreSQL, media, and recovery backup;
10. enables nightly backups, unattended Debian security updates, and optional
    closed-lid laptop operation.

After the health check passes, open the printed `/admin` address. The dashboard
starts with four ordinary tasks: add a sermon, build a Bible plan, invite a
person, or create an event. Invite people through **Member invitations** before
sending them the sign-in address. The default policy does not create accounts
for uninvited email addresses.

It is safe to rerun the same bootstrap or installer after an interruption.
Existing database and Payload secrets are preserved. A running deployment gets
a safety backup before migrations.

### Intel Surface USB path

For a Surface Pro 7 or another Intel 64-bit PC, the repository also contains a
guided Debian 13 appliance ISO builder. It bakes in the committed Heritage
source and offers the server setup after first login, while deliberately
leaving passwords, target-disk selection, and partition confirmation in
Debian's hands. See [`../appliance/README.md`](../appliance/README.md). Do not
use an ARM image for an Intel Surface.

## Daily operation

The installer adds one command with discoverable subcommands:

```sh
sudo heritage-community status
sudo heritage-community logs
sudo heritage-community logs -f
sudo heritage-community backup
sudo heritage-community update
sudo heritage-community restore --latest
sudo heritage-community reconfigure
sudo heritage-community uninstall
```

`status` also verifies that the nightly timer is enabled and warns when the
latest backup is more than 48 hours old.

`update` refuses tracked local edits, makes a backup, fast-forwards Git, builds
new images, applies migrations while the app is stopped, and requires health
checks to pass. It never resets code or automatically rewinds a database.

`restore` verifies checksums and archive paths, takes a pre-restore backup, and
requires exact typed confirmation before replacing anything.

`uninstall` preserves the database, media, configuration, source, tunnel
credentials, and backups by default. Permanent deletion requires
`--purge-data`, typing the community ID, and a separate `--purge-backups` flag
if backups should also be erased. Even then, it removes only recognized
Heritage backup entries and preserves unrelated files in the selected root.

The nightly timer starts at a randomized point within 30 minutes after the
time selected in the wizard, which avoids every installation doing heavy disk
work at exactly the same instant after a power recovery.

## Files and recovery

The standard layout is:

```text
/opt/heritage-community/
├── app/                    tracked Git checkout
├── backups/                dated, checksummed backups
├── config/community.env    database, Payload, SMTP, and optional tunnel token
├── config/cloudflared.yml  locally managed tunnel ingress, when selected
└── state/                  installer progress and non-secret mode metadata
```

Every completed backup contains:

- a PostgreSQL custom-format dump;
- an archive of uploaded media;
- a root-only recovery archive containing private configuration and locally
  managed tunnel credentials when present;
- release/migration metadata and SHA-256 checksums.

Because the recovery archive contains secrets, copy backups only to encrypted,
access-controlled storage. To recover from total machine loss, install Debian
on another machine, run the wizard with the same stable community ID, copy a
verified backup over, and use `heritage-community restore`. The recovery archive remains available for
manual secret/tunnel recovery; normal data restores do not silently overwrite
the new machine's secrets.

## Cloudflare alternatives

The default is a locally managed tunnel because it lets the wizard create both
the tunnel and DNS after one browser authorization. The installer deletes the
long-lived account-level `cert.pem` after setup; the dedicated service retains
only its tunnel-specific credential.

If a church already created a remotely managed tunnel in Cloudflare, choose
the token option. In the Cloudflare dashboard add the public hostname and set
its service to:

```text
http://community:3000
```

Then paste the tunnel token into the hidden prompt. You may also paste the full
Cloudflare command that contains `--token`; the wizard safely extracts only the
token without executing that command.

Local-only mode is available for development or SSH access without a domain or
SMTP account. The wizard prints a command such as:

```sh
ssh -L 3000:127.0.0.1:3000 your-user@server-address
```

Leave that terminal open and visit `http://127.0.0.1:3000/admin` on the
operator computer. Phones and Heritage clients cannot join this loopback URL,
and member sign-in is omitted until the server is reconfigured with SMTP and a
public tunnel.

## Troubleshooting

Start with:

```sh
sudo heritage-community status
sudo heritage-community logs
```

The installer records the interrupted phase and never deletes data on failure.
Correct the reported problem and rerun the same installer. Common external
problems are an existing conflicting DNS record, incorrect SMTP credentials,
an occupied loopback port, insufficient disk space, or a clock that is far out
of sync.

For an existing DNS conflict, the installer stops instead of overwriting the
record. For an existing PostgreSQL volume with a missing secret file, it stops
instead of generating a password that could make the database inaccessible.

## Non-interactive and test use

Operators managing several servers can supply the `HERITAGE_*` variables shown
by `install.sh --help`, export them in the current shell, and use token or
local-only tunnel mode. (Guided Cloudflare login still requires browser
authorization.) Let the script request `sudo` itself so it can preserve the
explicit Heritage variable allowlist:

```sh
bash community-server/deploy/install.sh --non-interactive --yes
```

Preview every phase without modifying the machine:

```sh
bash community-server/deploy/install.sh --dry-run --non-interactive --yes
```

Repository validation includes the three tunnel-mode dry runs and secret-leak
checks:

```sh
cd community-server
npm run test:deploy
npm run typecheck
npm run build
```
