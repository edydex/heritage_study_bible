package faith.heritage.app;

/** Clock boundaries only. This never changes recording timestamps or seeks. */
final class PlaybackBoundaries {
    private final double[] milliseconds;
    PlaybackBoundaries(double[] seconds) {
        milliseconds = new double[seconds.length];
        double previous = -1;
        for (int i = 0; i < seconds.length; i++) {
            double value = seconds[i];
            if (!Double.isFinite(value) || value < 0 || value < previous) throw new IllegalArgumentException("Invalid playback boundary");
            milliseconds[i] = value * 1000;
            previous = value;
        }
    }
    int index(long positionMs) {
        int low = 0, high = milliseconds.length;
        while (low < high) {
            int middle = (low + high) >>> 1;
            if (milliseconds[middle] <= positionMs) low = middle + 1;
            else high = middle;
        }
        return low;
    }
    long delayMs(long positionMs, float speed) {
        int next = index(positionMs);
        if (next == milliseconds.length || !Float.isFinite(speed) || speed <= 0) return -1;
        // Use playback speed to schedule a check, then re-read the real player
        // position when it fires. Never assume a timer proves audio has moved.
        return Math.max(16, Math.min(1000, (long) Math.ceil((milliseconds[next] - positionMs) / speed)));
    }
}
