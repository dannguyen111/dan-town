//! Move selection with a time-aware depth limit, from `dansing2MancalaPlayer.java`.

use crate::board::{Node, MAX, PLAY_PITS};
use crate::search::AlphaBeta;

const DEPTH_FACTOR: f64 = 2.9;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Decision {
    pub mv: i32,
    pub depth: i32,
    pub nodes: u64,
    pub value: f64,
}

pub fn depth_limit(node: &Node, time_remaining_ms: i64) -> i32 {
    if node.legal_moves().len() == 1 {
        return 1;
    }
    let raw = DEPTH_FACTOR
        * obvious_factor(node)
        * ((time_remaining_ms as f64) / pieces_remaining(node) as f64).ln();
    // Rust's `as i32` truncates toward zero and maps NaN to 0, same as Java's `(int)` cast.
    let mut depth = raw as i32;
    depth = depth.max(if time_remaining_ms > 5000 { 5 } else { 1 });
    depth = depth.min(21);
    depth + depth_adder(node)
}

pub fn choose_move(node: &Node, time_remaining_ms: i64) -> Decision {
    let depth = depth_limit(node, time_remaining_ms);
    let mut searcher = AlphaBeta::new(depth);
    let value = searcher.eval(node);
    Decision { mv: searcher.best_move, depth, nodes: searcher.node_count, value }
}

fn pieces_remaining(node: &Node) -> i32 {
    node.state[0..6].iter().sum::<i32>() + node.state[7..13].iter().sum::<i32>()
}

/// Search shallower when the position is "obvious": a free move is available,
/// or many stones can be captured.
fn obvious_factor(node: &Node) -> f64 {
    let free = if node.player == MAX { node.free_moves() } else { node.free_moves_opponent() };
    if free > 0 {
        return 0.5;
    }
    let mut factor = 1.0;
    for _ in 0..node.relative_capturable().abs() {
        factor *= 0.95;
    }
    factor
}

/// Search deeper as the side to move runs low on non-empty pits (fewer branches).
fn depth_adder(node: &Node) -> i32 {
    let (start, end) = if node.player == MAX { (0, PLAY_PITS) } else { (PLAY_PITS + 1, 2 * PLAY_PITS + 1) };
    let depth: f64 = (start..end).filter(|&i| node.state[i] == 0).map(|_| 0.75).sum();
    depth as i32
}
