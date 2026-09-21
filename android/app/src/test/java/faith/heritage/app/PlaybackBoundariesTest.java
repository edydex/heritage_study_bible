package faith.heritage.app;

import static org.junit.Assert.*;
import org.junit.Test;

public class PlaybackBoundariesTest {
    @Test public void usesTheActualPlayerPositionOnEitherSideOfARecordedBoundary() {
        PlaybackBoundaries cues = new PlaybackBoundaries(new double[]{4.642468681, 15.342468986, 16.262468566});
        assertEquals(0, cues.index(4642));
        assertEquals(1, cues.index(4643));
        assertEquals(1, cues.index(15342));
        assertEquals(2, cues.index(15343));
        assertEquals(0, cues.index(0)); // Seek back; no accumulated wall-clock offset.
        assertEquals(3, cues.index(20000));
        assertEquals(-1, cues.delayMs(20000, 1));
    }
    @Test public void recalculatesTheWakeUpFromPlaybackSpeedAndChecksAgainIfEarly() {
        PlaybackBoundaries cues = new PlaybackBoundaries(new double[]{5});
        assertEquals(200, cues.delayMs(4800, 1));
        assertEquals(100, cues.delayMs(4800, 2));
        assertEquals(267, cues.delayMs(4800, .75f));
        assertEquals(16, cues.delayMs(4999, 1));
        assertEquals(0, cues.index(4999)); // An early timer does not advance the marker.
        assertEquals(-1, cues.delayMs(4800, 0));
    }
    @Test public void handlesAdjacentSpansWithoutDuplicatesOrInventingMissingVerses() {
        PlaybackBoundaries cues = new PlaybackBoundaries(new double[]{4, 10, 10, 16, 30, 40});
        assertEquals(3, cues.index(10000));
        assertEquals(4, cues.index(25000));
        assertEquals(1000, cues.delayMs(25000, 1));
    }
    @Test public void rejectsInvalidOrReorderedTimestamps() {
        for (double[] values : new double[][]{{Double.NaN}, {Double.POSITIVE_INFINITY}, {-1}, {2, 1}}) {
            try { new PlaybackBoundaries(values); fail("Invalid boundary accepted"); }
            catch (IllegalArgumentException expected) { }
        }
    }
}
