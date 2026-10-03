//! The dansing2 evaluation function, from `dansing2MancalaNode.java`.
//!
//! The weights came from a linear regression on FairKalah game data
//! (`fairkalah-utility.ipynb`). Every feature is scored from MAX's point of view.
//! The arithmetic order matches the Java so results agree bit for bit.

use crate::board::{Node, MAX_SCORE_PIT, MIN_SCORE_PIT, PLAY_PITS};

impl Node {
    pub fn utility(&self) -> f64 {
        -0.7043
            + (1.0697 * self.score_dif() as f64)
            + (1.6145 * self.relative_mobility() as f64)
            + (1.6765 * self.free_moves() as f64)
            + (-0.5751 * self.free_moves_opponent() as f64)
            + (0.7141 * self.relative_capturable() as f64)
            + (0.8774 * self.state[0] as f64)
    }

    pub fn score_dif(&self) -> i32 {
        self.state[MAX_SCORE_PIT] - self.state[MIN_SCORE_PIT]
    }

    pub fn relative_mobility(&self) -> i32 {
        let mut max_moves = 0;
        let mut min_moves = 0;
        for i in 0..PLAY_PITS {
            if self.state[i] > 0 {
                max_moves += 1;
            }
            if self.state[i + PLAY_PITS + 1] > 0 {
                min_moves += 1;
            }
        }
        max_moves - min_moves
    }

    /// MAX pits whose stones end exactly in MAX's store.
    pub fn free_moves(&self) -> i32 {
        (0..PLAY_PITS).filter(|&i| self.state[i] + i as i32 == PLAY_PITS as i32).count() as i32
    }

    /// MIN pits whose stones end exactly in MIN's store.
    pub fn free_moves_opponent(&self) -> i32 {
        (PLAY_PITS + 1..PLAY_PITS * 2 + 1)
            .filter(|&i| self.state[i] + i as i32 == MIN_SCORE_PIT as i32)
            .count() as i32
    }

    pub fn relative_capturable(&self) -> i32 {
        self.capturable_stones() - self.vulnerable_stones()
    }

    pub fn vulnerable_stones(&self) -> i32 {
        let mut total = 0;
        for i in PLAY_PITS + 1..2 * PLAY_PITS + 1 {
            let mirrored = 2 * PLAY_PITS + 1 - i;
            let (reachable, plus_one) = self.reachable_pit(mirrored as i32, true);
            if self.state[i] == 0 && reachable {
                total += self.state[PLAY_PITS * 2 - i];
                if plus_one {
                    total += 1;
                }
            }
        }
        total
    }

    pub fn capturable_stones(&self) -> i32 {
        let mut total = 0;
        for i in 0..PLAY_PITS {
            let (reachable, plus_one) = self.reachable_pit((PLAY_PITS - i) as i32, false);
            if self.state[i] == 0 && reachable {
                total += self.state[PLAY_PITS * 2 - i];
                if plus_one {
                    total += 1;
                }
            }
        }
        total
    }

    /// Returns `(reachable, plus_one)`, mirroring the Java `boolean[]` result.
    fn reachable_pit(&self, pit: i32, opponent_side: bool) -> (bool, bool) {
        let pp = PLAY_PITS as i32;
        let (start, end) = if opponent_side { (pp + 1, 2 * pp + 1) } else { (0, pp) };
        let relative = if opponent_side { 2 * pp + 1 - pit } else { pp - pit };

        for i in start..end {
            let v = self.state[i as usize];
            if i == relative && v == 13 {
                return (true, true);
            }
            if opponent_side && i != relative && v == (relative - i).rem_euclid(13) && v <= 13 {
                return (true, v >= 8);
            }
            if !opponent_side && i != relative && v == (pp - i - pit).rem_euclid(13) && v <= 13 {
                return (true, v >= 8);
            }
        }
        (false, false)
    }
}
