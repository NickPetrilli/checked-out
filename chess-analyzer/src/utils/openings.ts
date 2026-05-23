// Lightweight opening detection via SAN move-prefix matching.
// Entries are sorted longest-prefix-first so the most specific match wins.
const OPENINGS: [string, string][] = [
  // Ruy López
  ['e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O', 'Ruy López: Closed'],
  ['e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O',                           'Ruy López: Open'],
  ['e4 e5 Nf3 Nc6 Bb5 a6 Ba4',                                    'Ruy López: Morphy Defense'],
  ['e4 e5 Nf3 Nc6 Bb5 Nf6',                                       'Ruy López: Berlin Defense'],
  ['e4 e5 Nf3 Nc6 Bb5',                                           'Ruy López'],
  // Italian
  ['e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4', 'Italian: Giuoco Piano, Main Line'],
  ['e4 e5 Nf3 Nc6 Bc4 Bc5 c3',         'Italian: Giuoco Piano'],
  ['e4 e5 Nf3 Nc6 Bc4 Nf6 d4',         'Italian: Two Knights, d4'],
  ['e4 e5 Nf3 Nc6 Bc4 Nf6',            'Italian: Two Knights Defense'],
  ['e4 e5 Nf3 Nc6 Bc4 Bc5',            'Italian: Giuoco Piano'],
  ['e4 e5 Nf3 Nc6 Bc4',                'Italian Game'],
  // Scotch
  ['e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5', 'Scotch: Classical'],
  ['e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6', 'Scotch: Schmidt'],
  ['e4 e5 Nf3 Nc6 d4 exd4 Nxd4',     'Scotch Game'],
  ['e4 e5 Nf3 Nc6 d4',                'Scotch Game'],
  // King's Gambit
  ["e4 e5 f4 exf4 Nf3", "King's Gambit: King's Knight Gambit"],
  ["e4 e5 f4 exf4 Bc4", "King's Gambit: Bishop's Gambit"],
  ["e4 e5 f4 exf4",     "King's Gambit Accepted"],
  ["e4 e5 f4 d5",       "King's Gambit: Falkbeer Countergambit"],
  ["e4 e5 f4",          "King's Gambit"],
  // Four Knights
  ['e4 e5 Nf3 Nc6 Nc3 Nf6', 'Four Knights Game'],
  // Vienna
  ['e4 e5 Nc3 Nf6 f4', 'Vienna Gambit'],
  ['e4 e5 Nc3',         'Vienna Game'],
  // Petrov
  ["e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4", "Petrov's Defense: Classical"],
  ["e4 e5 Nf3 Nf6",                   "Petrov's Defense"],
  // Philidor
  ['e4 e5 Nf3 d6', 'Philidor Defense'],
  // Open game
  ['e4 e5 Nf3 Nc6', 'Open Game'],
  ['e4 e5',          "King's Pawn Game"],
  // Sicilian
  ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6',   'Sicilian: Dragon'],
  ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6',   'Sicilian: Najdorf'],
  ['e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6',           'Sicilian: Taimanov'],
  ['e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6',           'Sicilian: Accelerated Dragon'],
  ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3',      'Sicilian: Scheveningen'],
  ['e4 c5 Nf3 Nc6 d4 cxd4 Nxd4',             'Sicilian: Open, Nc6'],
  ['e4 c5 Nf3 d6 d4 cxd4 Nxd4',             'Sicilian: Open, d6'],
  ['e4 c5 Nf3 e6 d4 cxd4 Nxd4',             'Sicilian: Open, e6'],
  ['e4 c5 Nc3 Nc6',                           'Sicilian: Closed'],
  ['e4 c5 Nf3',                               'Sicilian Defense'],
  ['e4 c5',                                   'Sicilian Defense'],
  // French
  ['e4 e6 d4 d5 Nc3 Bb4',       'French: Winawer'],
  ['e4 e6 d4 d5 Nc3 Nf6 Bg5',  'French: Classical'],
  ['e4 e6 d4 d5 Nd2',           'French: Tarrasch'],
  ['e4 e6 d4 d5 e5',            'French: Advance'],
  ['e4 e6 d4 d5 exd5',          'French: Exchange'],
  ['e4 e6 d4 d5 Nc3',           'French Defense'],
  ['e4 e6 d4',                  'French Defense'],
  ['e4 e6',                     'French Defense'],
  // Caro-Kann
  ['e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5', 'Caro-Kann: Classical'],
  ['e4 c6 d4 d5 e5',                 'Caro-Kann: Advance'],
  ['e4 c6 d4 d5 exd5',               'Caro-Kann: Exchange'],
  ['e4 c6 d4 d5 Nc3',                'Caro-Kann Defense'],
  ['e4 c6 d4',                       'Caro-Kann Defense'],
  ['e4 c6',                          'Caro-Kann Defense'],
  // Pirc / Modern
  ['e4 d6 d4 Nf6 Nc3 g6', 'Pirc Defense'],
  ['e4 g6 d4 d6 Nc3 Nf6', 'Modern Defense'],
  // Alekhine
  ["e4 Nf6 e5 Nd5 d4 d6", "Alekhine's Defense: Main Line"],
  ["e4 Nf6",               "Alekhine's Defense"],
  // Queen's Gambit
  ['d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6', "Queen's Gambit Declined: Classical"],
  ['d4 d5 c4 e6 Nc3 Nf6 Bg5',                    "Queen's Gambit Declined: Orthodox"],
  ['d4 d5 c4 c6 Nf3 Nf6 Nc3',                    'Slav Defense: Three Knights'],
  ['d4 d5 c4 c6 Nf3 Nf6',                        'Slav Defense'],
  ['d4 d5 c4 c6',                                 'Slav Defense'],
  ['d4 d5 c4 dxc4 Nf3 Nf6 e3',                   "Queen's Gambit Accepted: Classical"],
  ['d4 d5 c4 dxc4 e4',                            "Queen's Gambit Accepted: Central"],
  ['d4 d5 c4 dxc4',                               "Queen's Gambit Accepted"],
  ['d4 d5 c4 e6 Nc3 Nf6',                         "Queen's Gambit Declined"],
  ['d4 d5 c4 e6',                                 "Queen's Gambit Declined"],
  ['d4 d5 c4',                                    "Queen's Gambit"],
  // King's Indian
  ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2", "King's Indian: Classical"],
  ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3",           "King's Indian: Sämisch"],
  ["d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Be2",          "King's Indian Defense"],
  ["d4 Nf6 c4 g6 Nc3 Bg7 e4",                  "King's Indian Defense"],
  ["d4 Nf6 c4 g6 Nc3 Bg7",                     "King's Indian Defense"],
  ["d4 Nf6 c4 g6 Nc3",                          "King's Indian Defense"],
  ["d4 Nf6 c4 g6",                              "King's Indian Defense"],
  // Nimzo-Indian
  ["d4 Nf6 c4 e6 Nc3 Bb4 e3",  'Nimzo-Indian: Rubinstein'],
  ["d4 Nf6 c4 e6 Nc3 Bb4 Qc2", 'Nimzo-Indian: Classical'],
  ["d4 Nf6 c4 e6 Nc3 Bb4",     'Nimzo-Indian Defense'],
  // Queen's Indian
  ["d4 Nf6 c4 e6 Nf3 b6", "Queen's Indian Defense"],
  // Catalan
  ['d4 Nf6 c4 e6 Nf3 d5 g3', 'Catalan Opening'],
  // Grünfeld
  ['d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4', 'Grünfeld Defense: Exchange'],
  ['d4 Nf6 c4 g6 Nc3 d5',               'Grünfeld Defense'],
  // Benoni
  ['d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6', 'Benoni Defense'],
  ['d4 Nf6 c4 c5 d5',                      'Benoni Defense'],
  // Dutch
  ['d4 f5 c4',  'Dutch Defense'],
  ['d4 f5',     'Dutch Defense'],
  // London System
  ['d4 d5 Nf3 Nf6 Bf4', 'London System'],
  ['d4 d5 Nf3 Bf4',     'London System'],
  ['d4 Nf6 Nf3 d5 Bf4', 'London System'],
  ['d4 Nf6 Bf4',         'London System'],
  // Trompowsky
  ['d4 Nf6 Bg5', 'Trompowsky Attack'],
  // Generic d4
  ['d4 d5', "Queen's Pawn Game"],
  ['d4',    "Queen's Pawn Game"],
  // English
  ['c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2', 'English: Symmetrical'],
  ['c4 e5 Nc3 Nf6 g3 Bb4',               'English: Four Knights'],
  ['c4 c5 Nf3 Nf6 d4 cxd4 Nxd4',         'English: Symmetrical'],
  ["c4 e5 Nc3",                           "English: King's English"],
  ["c4 e5",                               "English: King's English"],
  ['c4 c5',  'English: Symmetrical'],
  ['c4 Nf6', 'English Opening'],
  ['c4',     'English Opening'],
  // Réti / King's Indian Attack
  ["Nf3 Nf6 c4 g6 g3 Bg7 Bg2 O-O", 'Réti Opening'],
  ['Nf3 d5 c4 e6',                   'Réti Opening'],
  ['Nf3 d5 c4',                      'Réti Opening'],
  ['Nf3 Nf6 c4',                     'Réti Opening'],
  ["Nf3 d5 g3",                      "King's Indian Attack"],
  ['Nf3',                            'Réti Opening'],
  // Bird's Opening
  ["f4 e5 fxe5 d6 exd6 Bxd6", "Bird's Opening: From's Gambit"],
  ["f4 d5 Nf3",                "Bird's Opening"],
  ['f4',                       "Bird's Opening"],
];

export function detectOpening(sanMoves: string[]): string | null {
  if (sanMoves.length === 0) return null;
  const key = sanMoves.join(' ');
  for (const [prefix, name] of OPENINGS) {
    if (key === prefix || key.startsWith(prefix + ' ')) return name;
  }
  return null;
}
