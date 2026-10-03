//! Parity with the original Java bot.
//!
//! `fixtures/parity.jsonl` was produced by `parity/ParityGen.java` running the upstream
//! `dansing_fairkalah` sources. For every recorded position, the Rust port must give the
//! exact same heuristic value and choose the exact same move.

use mancala_engine::{choose_move, Node, State};

struct Case {
    state: State,
    player: u8,
    time: i64,
    utility: f64,
    mv: i32,
}

/// Tiny parser for the fixed fixture format, so the crate needs no serde dependency.
fn field<'a>(line: &'a str, key: &str) -> &'a str {
    let start = line.find(&format!("\"{key}\":")).expect(key) + key.len() + 3;
    let rest = &line[start..];
    let end = if rest.starts_with('[') { rest.find(']').unwrap() + 1 } else { rest.find([',', '}']).unwrap() };
    &rest[..end]
}

fn cases() -> Vec<Case> {
    include_str!("fixtures/parity.jsonl")
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| {
            let nums: Vec<i32> = field(l, "state")
                .trim_matches(['[', ']'])
                .split(',')
                .map(|n| n.parse().unwrap())
                .collect();
            Case {
                state: nums.try_into().unwrap(),
                player: field(l, "player").parse().unwrap(),
                time: field(l, "time").parse().unwrap(),
                utility: field(l, "utility").parse().unwrap(),
                mv: field(l, "move").parse().unwrap(),
            }
        })
        .collect()
}

#[test]
fn fixtures_are_present() {
    assert!(cases().len() > 200, "expected the generated Java fixtures");
}

#[test]
fn heuristic_matches_java_bit_for_bit() {
    for (i, c) in cases().iter().enumerate() {
        let node = Node::new(c.state, c.player);
        assert_eq!(node.utility().to_bits(), c.utility.to_bits(), "case {i}: {:?}", c.state);
    }
}

#[test]
fn chosen_moves_match_java() {
    let cases = cases();
    let mismatches: Vec<_> = cases
        .iter()
        .enumerate()
        .filter_map(|(i, c)| {
            let got = choose_move(&Node::new(c.state, c.player), c.time).mv;
            (got != c.mv).then(|| format!("case {i}: java={} rust={got} {:?} p{}", c.mv, c.state, c.player))
        })
        .collect();
    assert!(mismatches.is_empty(), "{} of {} differ:\n{}", mismatches.len(), cases.len(), mismatches.join("\n"));
}
