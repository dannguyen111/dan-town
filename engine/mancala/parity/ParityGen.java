import java.io.PrintStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Random;

/**
 * Generates parity fixtures from the ORIGINAL Java bot (dansing_fairkalah).
 *
 * Compile it together with the upstream sources:
 *   javac -d out ParityGen.java path/to/dansing_fairkalah/*.java
 *   java -cp out ParityGen > ../tests/fixtures/parity.jsonl
 *
 * Each line holds one position with the Java engine's utility, depth limit and chosen move.
 * The Rust test suite (tests/parity.rs) replays every line and requires identical results.
 */
public class ParityGen {
    public static void main(String[] args) {
        PrintStream out = System.out;
        // dansing2MancalaPlayer prints debug lines; silence them.
        System.setOut(new PrintStream(OutputStream.nullOutputStream()));

        Random rng = new Random(20261003L);
        long[] times = {300, 1500, 4000, 9000};
        dansing2MancalaPlayer bot = new dansing2MancalaPlayer();
        int emitted = 0;

        for (int board = 0; board < 254; board++) {
            dansing2MancalaNode node = new dansing2MancalaNode(board);
            int plies = rng.nextInt(30);
            for (int p = 0; p < plies && !node.gameOver(); p++) {
                ArrayList<Integer> moves = node.getLegalMoves();
                node.makeMove(moves.get(rng.nextInt(moves.size())));
            }
            if (node.gameOver()) continue;

            long t = times[rng.nextInt(times.length)];
            int[] s = node.getState().clone();
            int player = node.getPlayer();
            dansing2MancalaNode probe = new dansing2MancalaNode(node);
            double utility = probe.utility();
            int move = bot.chooseMove(new dansing2MancalaNode(node), t);

            StringBuilder sb = new StringBuilder("{\"state\":[");
            for (int i = 0; i < s.length; i++) sb.append(i == 0 ? "" : ",").append(s[i]);
            sb.append("],\"player\":").append(player)
              .append(",\"time\":").append(t)
              .append(",\"utility\":").append(Double.toString(utility))
              .append(",\"move\":").append(move).append("}");
            out.println(sb);
            emitted++;
        }
    }
}
