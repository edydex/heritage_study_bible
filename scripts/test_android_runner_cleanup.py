#!/usr/bin/env python3
"""Exercise bounded ADB bootstrap and cleanup without invoking a real device."""
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


def check(scenario):
    with tempfile.TemporaryDirectory(prefix='heritage-runner-fault-') as folder:
        root = Path(folder)
        for name in ['scripts', 'tools', 'runtime', 'sdk/emulator', 'android']:
            (root / name).mkdir(parents=True, exist_ok=True)
        shutil.copyfile(runner, root / 'scripts/run.sh')
        executable(root / 'tools/adb', '''
            import json, os, pathlib, sys, time
            root = pathlib.Path(os.environ['RUNNER_FIXTURE_ROOT'])
            state_file = root / 'adb-state.json'
            state = json.loads(state_file.read_text()) if state_file.exists() else {'calls': []}
            args = sys.argv[1:]
            state['calls'].append(args)
            state_file.write_text(json.dumps(state))
            scenario = os.environ['RUNNER_FIXTURE_SCENARIO']
            if args == ['start-server']:
                attempt = state['calls'].count(['start-server'])
                print('simulated-adb-start-attempt=' + str(attempt), flush=True)
                (pathlib.Path(os.environ['TMPDIR']) / ('adb.' + str(os.getuid()) + '.log')).write_text('simulated-adb-daemon')
                if scenario in ['startup-always-hangs', 'reset-hangs'] or (scenario == 'startup-recovers' and attempt == 1):
                    time.sleep(60)
            elif args == ['kill-server']:
                print('simulated-adb-server-stop', flush=True)
                if scenario == 'reset-hangs':
                    time.sleep(60)
            elif scenario == 'emulator-fails':
                time.sleep(60)
            elif args == ['shell', 'getprop', 'sys.boot_completed']:
                print('1')
            elif args == ['shell', 'cmd', 'overlay', 'list']:
                print('[x] com.android.internal.systemui.navbar.threebutton')
            elif args == ['logcat', '-d']:
                print('simulated-device-log')
        ''', python=True)
        executable(root / 'tools/sdkmanager', 'exit 0\n')
        executable(root / 'tools/avdmanager', '''
            import os, pathlib, sys
            sys.stdin.read()
            (pathlib.Path(os.environ['ANDROID_AVD_HOME']) / 'heritage-acceptance.ini').write_text('fixture')
        ''', python=True)
        executable(root / 'sdk/emulator/emulator', '''
            import os, pathlib, sys, time
            root = pathlib.Path(os.environ['RUNNER_FIXTURE_ROOT'])
            if os.environ['RUNNER_FIXTURE_SCENARIO'] == 'emulator-fails':
                print('simulated-emulator-start-failure', file=sys.stderr, flush=True)
                sys.exit(1)
            (root / 'emulator.pid').write_text(str(os.getpid()))
            print('simulated-running-emulator', flush=True)
            time.sleep(60)
        ''', python=True)
        executable(root / 'android/gradlew', '''
            printf 'native-tests-once\n' >> "$RUNNER_FIXTURE_ROOT/native-tests.txt"
        ''')
        # Bound each simulated external call to 0.3 seconds. Omitting timeout
        # anywhere in the real runner still exceeds the outer test deadline.
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
            'TMPDIR': str(root / 'runtime'),
            'RUNNER_FIXTURE_ROOT': str(root),
            'RUNNER_FIXTURE_SCENARIO': scenario,
        }
        started = time.monotonic()
        process = subprocess.Popen(
            ['bash', str(root / 'scripts/run.sh')], env=env,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True,
        )
        try:
            stdout, stderr = process.communicate(timeout=6)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
            raise AssertionError(f'{scenario}: runner or cleanup exceeded the bounded deadline')
        evidence = root / 'android/app/build/native-acceptance'
        calls = json.loads((root / 'adb-state.json').read_text())['calls']
        startup = (evidence / 'adb-startup.log').read_text()
        phase = (evidence / 'runner-phase.txt').read_text().strip()
        expected_exit = 0 if scenario == 'startup-recovers' else 124
        assert process.returncode == expected_exit, (scenario, process.returncode, stdout, stderr)
        assert (evidence / 'runner-exit.txt').read_text().strip() == f'exitCode={expected_exit}'
        assert (evidence / 'adb-daemon.log').read_text() == 'simulated-adb-daemon'
        assert 'cleanup: stopping ADB server' in startup
        assert calls[-1] == ['kill-server'], (scenario, calls)
        if scenario == 'emulator-fails':
            assert (evidence / 'emulator.log').read_text().strip() == 'simulated-emulator-start-failure'
            assert calls.count(['start-server']) == 1
            assert phase == 'emulator-boot'
        elif scenario == 'startup-recovers':
            assert 'attempt=1 exitCode=124' in startup
            assert 'reset exitCode=0' in startup and 'attempt=2 exitCode=0' in startup
            assert calls.count(['start-server']) == 2
            assert calls[:3] == [['start-server'], ['kill-server'], ['start-server']]
            assert (root / 'native-tests.txt').read_text() == 'native-tests-once\n'
            assert phase == 'native-tests'
            emulator_pid = int((root / 'emulator.pid').read_text())
            try:
                os.kill(emulator_pid, 0)
            except ProcessLookupError:
                pass
            else:
                raise AssertionError('Successful-run cleanup left the simulated emulator running')
        else:
            assert 'attempt=1 exitCode=124' in startup
            assert not (evidence / 'avd-create.log').exists()
            assert not (evidence / 'emulator.log').exists()
            assert not (root / 'native-tests.txt').exists()
            assert phase == 'adb-start-server'
            assert not any(command[:1] in [['logcat'], ['pull'], ['emu'], ['wait-for-device']] for command in calls)
            if scenario == 'startup-always-hangs':
                assert calls.count(['start-server']) == 2
                assert calls[:3] == [['start-server'], ['kill-server'], ['start-server']]
                assert 'attempt=2 exitCode=124' in startup
            else:
                assert calls.count(['start-server']) == 1
                assert 'reset exitCode=124' in startup
        print(json.dumps({
            'scenario': scenario,
            'exitCode': process.returncode,
            'elapsedSeconds': round(time.monotonic() - started, 2),
            'startupAttempts': calls.count(['start-server']),
            'finalPhase': phase,
            'startupAndCleanupEvidenceRetained': True,
        }))


for scenario in ['emulator-fails', 'startup-recovers', 'startup-always-hangs', 'reset-hangs']:
    check(scenario)
