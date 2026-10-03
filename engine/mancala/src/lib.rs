//! # mancala-engine
//!
//! A faithful Rust port of Dan Nguyen & Rajwat Singh's `dansing2` FairKalah bot
//! (originally Java, built on Todd W. Neller's Mancala framework).
//!
//! The crate builds as a normal library (for native tests) and as a raw `cdylib`
//! for `wasm32-unknown-unknown`. The WASM exports below use a plain C ABI and one
//! shared static buffer, so the browser needs no `wasm-bindgen` glue: the module
//! is a few dozen KB and loads with `WebAssembly.instantiate`.

pub mod board;
pub mod boards;
pub mod heuristic;
pub mod player;
pub mod search;

pub use board::{Node, State, MAX, MIN};
pub use boards::FAIRKALAH_BOARDS;
pub use player::{choose_move, Decision};

#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::*;
    use core::ptr::addr_of_mut;

    /// Shared I/O buffer. JS writes a board in, calls a function, and reads it back.
    /// WASM is single-threaded per instance, so this is never accessed concurrently.
    static mut BUF: State = [0; 14];
    static mut LAST: Decision = Decision { mv: -1, depth: 0, nodes: 0, value: 0.0 };

    fn buf() -> &'static mut State {
        unsafe { &mut *addr_of_mut!(BUF) }
    }

    #[no_mangle]
    pub extern "C" fn state_ptr() -> *mut i32 {
        buf().as_mut_ptr()
    }

    #[no_mangle]
    pub extern "C" fn board_count() -> i32 {
        FAIRKALAH_BOARDS.len() as i32
    }

    /// Copy FairKalah board `index` into the buffer.
    #[no_mangle]
    pub extern "C" fn load_board(index: i32) {
        let i = (index.max(0) as usize).min(FAIRKALAH_BOARDS.len() - 1);
        *buf() = FAIRKALAH_BOARDS[i];
    }

    /// Returns 1 if `mv` is legal for `player` on the buffered board.
    #[no_mangle]
    pub extern "C" fn is_legal(player: i32, mv: i32) -> i32 {
        Node::new(*buf(), player as u8).is_legal(mv) as i32
    }

    /// Apply `mv` to the buffered board in place. Returns the next player to move,
    /// or -1 if the move is illegal. The rules live only here; JS never re-implements them.
    #[no_mangle]
    pub extern "C" fn apply_move(player: i32, mv: i32) -> i32 {
        let mut node = Node::new(*buf(), player as u8);
        if !node.is_legal(mv) {
            return -1;
        }
        node.make_move(mv);
        *buf() = node.state;
        node.player as i32
    }

    #[no_mangle]
    pub extern "C" fn game_over() -> i32 {
        Node::new(*buf(), MAX).game_over() as i32
    }

    /// Run the dansing2 bot for `player` on the buffered board.
    #[no_mangle]
    pub extern "C" fn choose(player: i32, time_remaining_ms: f64) -> i32 {
        let d = choose_move(&Node::new(*buf(), player as u8), time_remaining_ms as i64);
        unsafe { *addr_of_mut!(LAST) = d };
        d.mv
    }

    #[no_mangle]
    pub extern "C" fn last_depth() -> i32 {
        unsafe { (*addr_of_mut!(LAST)).depth }
    }

    #[no_mangle]
    pub extern "C" fn last_nodes() -> f64 {
        unsafe { (*addr_of_mut!(LAST)).nodes as f64 }
    }

    #[no_mangle]
    pub extern "C" fn last_value() -> f64 {
        unsafe { (*addr_of_mut!(LAST)).value }
    }
}
