//! `cargo run --release --example bench`: time the bot's opening move at each difficulty clock.
use mancala_engine::{choose_move, Node, FAIRKALAH_BOARDS, MAX};
use std::time::Instant;

fn main() {
    for (label, clock) in [("easy", 5_000), ("medium", 30_000), ("hard", 300_000)] {
        let mut total = 0.0;
        let mut nodes = 0;
        for board in [0usize, 63, 127, 191, 253] {
            let t = Instant::now();
            let d = choose_move(&Node::new(FAIRKALAH_BOARDS[board], MAX), clock);
            total += t.elapsed().as_secs_f64();
            nodes += d.nodes;
            println!("{label:>6} board {board:>3}: move {} depth {} nodes {:>11} in {:.3}s", d.mv, d.depth, d.nodes, t.elapsed().as_secs_f64());
        }
        println!("{label:>6} avg {:.3}s, {:.1} M nodes/s\n", total / 5.0, nodes as f64 / total / 1e6);
    }
}
