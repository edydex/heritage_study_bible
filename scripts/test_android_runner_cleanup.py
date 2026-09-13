#!/usr/bin/env python3
"""A missing emulator must not strand the runner before evidence upload."""
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import tempfile
import textwrap
import time

runner = Path(__file__).resolve().parent / 'run-android-acceptance.sh'


def executable(path, contents, *, python=False):
    prefix = f'#!{sys.executable}\n' if python else '#!/bin/sh\n'
    path.write_text(prefix + textwrap.dedent(contents).lstrip())
    path.chmod(0o755)


with tempfile.TemporaryDirectory(prefix='heritage-runner-fault-') as folder:
    root = Path(folder)
    (root / 'scripts').mkdir()
    (root / 'tools').mkdir()
    (root / 'runtime').mkdir()
    (root / 'sdk/emulator').mkdir(parents=True)
    shutil.copyfile(runner, root / 'scripts/run.sh')
    executable(root / 'tools/adb', '''
        import sys, time
        if sys.argv[1:] == ['start-server']:
            sys.exit(0)
        time.sleep(60)
    ''', python=True)
    executable(root / 'tools/sdkmanager', 'exit 0\n')
    executable(root / 'tools/avdmanager', '''
        import os, pathlib, sys
        sys.stdin.read()
        (pathlib.Path(os.environ['ANDROID_AVD_HOME']) / 'heritage-acceptance.ini').write_text('fixture')
    ''', python=True)
    executable(root / 'sdk/emulator/emulator', '''
        echo simulated-emulator-start-failure >&2
        exit 1
    ''')
    # Shorten bounded calls for this fault injection. A cleanup command that
    # omits timeout still hangs and fails the outer six-second deadline.
    executable(root / 'tools/timeout', '''
        import os, signal, subprocess, sys
        args = [arg for arg in sys.argv[1:] if not arg.startswith('--kill-after=')]
        process = subprocess.Popen(args[1:], start_new_session=True)
        try:
            sys.exit(process.wait(timeout=0.3))
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
            sys.exit(124)
    ''', python=True)
    env = {
        **os.environ,
        'PATH': str(root / 'tools') + os.pathsep + os.environ['PATH'],
        'ANDROID_HOME': str(root / 'sdk'),
        'RUNNER_TEMP': str(root / 'runtime'),
    }
    started = time.monotonic()
    process = subprocess.Popen(
        ['bash', str(root / 'scripts/run.sh')], env=env,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True,
    )
    hung = False
    try:
        process.communicate(timeout=6)
    except subprocess.TimeoutExpired:
        hung = True
        os.killpg(process.pid, signal.SIGKILL)
        process.communicate()
    log = root / 'android/app/build/native-acceptance/emulator.log'
    retained = log.exists() and log.read_text().strip() == 'simulated-emulator-start-failure'
    print(json.dumps({
        'cleanupHung': hung,
        'exitCode': process.returncode,
        'elapsedSeconds': round(time.monotonic() - started, 2),
        'emulatorLogRetained': retained,
    }))
    if hung or process.returncode != 124 or not retained:
        raise SystemExit('Runner did not preserve evidence and exit after emulator failure')
