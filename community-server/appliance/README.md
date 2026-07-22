# Intel Surface appliance installer

This directory builds the pre-baked installer for an Intel Surface Pro 7. It
uses the official Debian 13.6.0 `amd64` netinst image, preserves its BIOS/UEFI
hybrid boot data, adds a **Heritage Community Server guided install** choice,
and bakes the exact committed application source into the ISO.

The media is intentionally guided rather than unattended. Debian still asks
for the administrator/user password, displays the internal drive selection,
and requires partition confirmation. Only after Debian finishes does it copy
the Heritage source and offer the plain-language server setup wizard.

## Build and verify on macOS

```sh
brew install xorriso
bash community-server/appliance/build-installer.sh \
  /tmp/debian-13.6.0-amd64-netinst.iso
npm --prefix community-server run test:appliance
```

The builder accepts only the published Debian 13.6.0 SHA-512, refuses dirty
application source, replays Debian's hybrid BIOS/UEFI boot equipment, extracts
the modified files for comparison, and writes a SHA-256 beside the ISO.

## Write a USB on macOS

First identify the external disk with `diskutil list external physical`. Then:

```sh
bash community-server/appliance/write-usb-macos.sh \
  community-server/appliance/output/heritage-community-debian-13.6.0-amd64.iso \
  /dev/diskN
```

The writer refuses partitions, internal disks, virtual disks, and undersized
drives. It shows the selected partition table, requires a typed disk-specific
erase phrase, writes the image, and compares every image byte with the USB
before ejecting it.

## Install on Surface Pro 7

1. Back up Windows and any files that matter. The Debian partition screen can
   replace Windows if you choose the whole internal drive.
2. Shut down the Surface. Disconnect other USB storage.
3. Insert the Heritage USB, hold **Volume Down**, press and release **Power**,
   and keep holding Volume Down until spinning dots appear.
4. Choose **Heritage Community Server guided install**.
5. Follow Debian's user/password and disk screens. For a dedicated server, the
   simplest choice is guided use of the entire internal disk, but read the
   final partition summary before confirming it.
6. After reboot, sign in. Accept the prompt to start Heritage setup, or run
   `sudo heritage-community-setup` later.

Keep Secure Boot enabled initially. Debian's signed installer normally works
with the Surface's third-party UEFI certificate option. If the USB is not
offered, enter Surface UEFI with **Volume Up + Power**, confirm USB boot is
enabled and USB Storage is in the boot order, and select the Microsoft plus
third-party certificate configuration if available.

The normal Debian kernel is the first choice. Install the linux-surface kernel
only if a device feature you actually need is broken after setup; the server
does not depend on touch or cameras.
