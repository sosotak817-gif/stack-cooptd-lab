(function (root) {
  const day = 86400000;
  const monday = Date.UTC(1970, 0, 5) - 9 * 3600000;

  function weekAt(time = Date.now()) {
    return Math.floor((time - monday) / (7 * day));
  }

  function startDate(week) {
    return new Date(monday + week * 7 * day + 9 * 3600000).toISOString().slice(0, 10);
  }

  function puzzle(week, presets) {
    let seed = week >>> 0;
    function draw(length) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor(seed / 4294967296 * length);
    }
    const modes = ['hard', 'hell', 'abyss', 'deepsea'];
    const decks = ['clara', 'goblin', 'aclaraKaiser'];
    const deck = decks[week % decks.length];
    const { cells, marks, name } = structuredClone(presets[deck]);
    for (let i = 0; i < 3; i++) {
      const from = draw(cells.length);
      const to = (from + 1 + draw(cells.length - 1)) % cells.length;
      const { row, col } = cells[from];
      Object.assign(cells[from], { row: cells[to].row, col: cells[to].col });
      Object.assign(cells[to], { row, col });
    }
    return { cells, marks, name, mode: modes[draw(modes.length)] };
  }

  root.CoopWeekly = { weekAt, startDate, puzzle, moveLimit: 3 };
})(globalThis);
