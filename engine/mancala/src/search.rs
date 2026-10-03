//! Depth-limited alpha-beta, from `dansing2AlphaBetaSearcher.java`.
//!
//! The Java builds a child-node list on the heap at every ply. Here nodes are
//! 64-byte `Copy` values, so the search allocates nothing. The visiting order,
//! the strict `>`/`<` tie-breaking and the cutoff test are unchanged, so for a
//! given depth this picks the same move as the original.

use crate::board::{Node, MAX, UNDEFINED_MOVE};

#[derive(Default)]
pub struct AlphaBeta {
    pub depth_limit: i32,
    pub node_count: u64,
    pub best_move: i32,
}

impl AlphaBeta {
    pub fn new(depth_limit: i32) -> Self {
        AlphaBeta { depth_limit, node_count: 0, best_move: UNDEFINED_MOVE }
    }

    pub fn eval(&mut self, node: &Node) -> f64 {
        self.node_count = 0;
        self.search(node, self.depth_limit, f64::NEG_INFINITY, f64::INFINITY)
    }

    fn search(&mut self, node: &Node, depth_left: i32, mut alpha: f64, mut beta: f64) -> f64 {
        let maximizing = node.player == MAX;
        let mut local_best = UNDEFINED_MOVE;
        let mut best = if maximizing { f64::NEG_INFINITY } else { f64::INFINITY };
        self.node_count += 1;

        if node.game_over() || depth_left == 0 {
            return node.utility();
        }

        for &mv in node.legal_moves().as_slice() {
            let mut child = *node;
            child.make_move(mv);
            let u = self.search(&child, depth_left - 1, alpha, beta);
            if (maximizing && u > best) || (!maximizing && u < best) {
                best = u;
                local_best = child.prev_move;
                if maximizing {
                    alpha = alpha.max(best);
                } else {
                    beta = beta.min(best);
                }
                if beta <= alpha {
                    break;
                }
            }
        }

        // As in the Java: the root's frame returns last, so its value is what remains.
        self.best_move = local_best;
        best
    }
}
