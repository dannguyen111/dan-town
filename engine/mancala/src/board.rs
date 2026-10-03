//! Kalah rules, ported from Todd W. Neller's `MancalaNode.java`.
//!
//! Board layout (same as the Java engine):
//! `state[0..6]`  = MAX's pits (from MAX's pit "6" down to "1"), `state[6]`  = MAX's store,
//! `state[7..13]` = MIN's pits,                                  `state[13]` = MIN's store.

pub const PLAY_PITS: usize = 6;
pub const MAX_SCORE_PIT: usize = PLAY_PITS;
pub const MIN_SCORE_PIT: usize = 2 * PLAY_PITS + 1;
pub const TOTAL_PITS: usize = 2 * (PLAY_PITS + 1);
pub const NUM_PIECES: i32 = 2 * PLAY_PITS as i32 * 4;

pub const MAX: u8 = 0;
pub const MIN: u8 = 1;
pub const UNDEFINED_MOVE: i32 = -1;

pub type State = [i32; TOTAL_PITS];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Node {
    pub state: State,
    pub player: u8,
    pub prev_move: i32,
}

impl Node {
    pub fn new(state: State, player: u8) -> Self {
        Node { state, player, prev_move: UNDEFINED_MOVE }
    }

    pub fn game_over(&self) -> bool {
        self.state[MAX_SCORE_PIT] + self.state[MIN_SCORE_PIT] == NUM_PIECES
    }

    /// Legal moves in the order `dansing2MancalaNode.getLegalMoves()` produces them
    /// (pit indices high-to-low). Order matters: alpha-beta keeps the first best move found.
    pub fn legal_moves(&self) -> MoveList {
        let offset = if self.player == MAX { 0 } else { MAX_SCORE_PIT + 1 };
        let mut moves = MoveList::default();
        for i in (offset..offset + PLAY_PITS).rev() {
            if self.state[i] > 0 {
                moves.push(i as i32);
            }
        }
        moves
    }

    pub fn is_legal(&self, mv: i32) -> bool {
        self.legal_moves().as_slice().contains(&mv)
    }

    /// Sow, capture, extra turn, and starvation sweep, exactly like `MancalaNode.makeMove`.
    pub fn make_move(&mut self, mv: i32) {
        let s = &mut self.state;
        let mut position = mv as usize;
        self.prev_move = mv;

        let mut pieces = s[position];
        s[position] = 0;
        let skip = if self.player == MAX { MIN_SCORE_PIT } else { MAX_SCORE_PIT };
        while pieces > 0 {
            position = (position + 1) % TOTAL_PITS;
            if position == skip {
                continue;
            }
            s[position] += 1;
            pieces -= 1;
        }

        let score_pit = if self.player == MAX { MAX_SCORE_PIT } else { MIN_SCORE_PIT };
        let dist = score_pit as i32 - position as i32;
        if s[position] == 1 && dist > 0 && dist <= PLAY_PITS as i32 {
            let opposite = MIN_SCORE_PIT - position - 1;
            s[score_pit] += 1;
            s[position] -= 1;
            s[score_pit] += s[opposite];
            s[opposite] = 0;
        }

        if position != score_pit {
            self.player = if self.player == MAX { MIN } else { MAX };
        }

        let mut max_side = 0;
        let mut min_side = 0;
        for pos in 0..MAX_SCORE_PIT {
            max_side += s[pos];
            min_side += s[pos + MAX_SCORE_PIT + 1];
        }
        if max_side == 0 || min_side == 0 {
            s[MAX_SCORE_PIT] += max_side;
            s[MIN_SCORE_PIT] += min_side;
            for pos in 0..MAX_SCORE_PIT {
                s[pos] = 0;
                s[pos + MAX_SCORE_PIT + 1] = 0;
            }
        }
    }
}

/// Fixed-capacity move list so search never touches the heap.
#[derive(Clone, Copy, Default)]
pub struct MoveList {
    moves: [i32; PLAY_PITS],
    len: usize,
}

impl MoveList {
    fn push(&mut self, mv: i32) {
        self.moves[self.len] = mv;
        self.len += 1;
    }
    pub fn len(&self) -> usize {
        self.len
    }
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }
    pub fn as_slice(&self) -> &[i32] {
        &self.moves[..self.len]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const START: State = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];

    #[test]
    fn landing_in_store_grants_extra_turn() {
        // Pit index 2 holds 4 stones: 3,4,5 then the store (6).
        let mut n = Node::new(START, MAX);
        n.make_move(2);
        assert_eq!(n.state[MAX_SCORE_PIT], 1);
        assert_eq!(n.player, MAX);
    }

    #[test]
    fn capture_takes_opposite_pit() {
        let mut s = [0; TOTAL_PITS];
        s[0] = 1; // sow into empty pit 1
        s[5] = 1; // keep MAX side non-empty after the move
        s[11] = 5; // opposite of pit 1 is 13 - 1 - 1 = 11
        s[7] = 3;
        let mut n = Node::new(s, MAX);
        n.make_move(0);
        assert_eq!(n.state[MAX_SCORE_PIT], 6);
        assert_eq!(n.state[11], 0);
        assert_eq!(n.player, MIN);
    }

    #[test]
    fn sowing_skips_opponent_store() {
        let mut s = START;
        s[5] = 13;
        let mut n = Node::new(s, MAX);
        n.make_move(5);
        assert_eq!(n.state[MIN_SCORE_PIT], 0);
        assert_eq!(n.state.iter().sum::<i32>(), START.iter().sum::<i32>() + 9);
    }

    #[test]
    fn legal_moves_are_high_to_low() {
        let n = Node::new(START, MIN);
        assert_eq!(n.legal_moves().as_slice(), &[12, 11, 10, 9, 8, 7]);
    }
}
