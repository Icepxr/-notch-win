'use strict';
const fs = require('node:fs');
const path = require('node:path');

// A package/product rename must not strand the original shelf or scratchpad.
// Keep an already-used new profile when the user has parked files or notes there.
function chooseProfile(current, legacy, exists = fs.existsSync) {
  if (path.resolve(current).toLowerCase() === path.resolve(legacy).toLowerCase()) return current;
  if (!exists(path.join(legacy, 'settings.json'))) return current;
  if (['scratchpad.txt', 'shelf.json'].some((name) => exists(path.join(current, name)))) return current;
  return legacy;
}
module.exports = { chooseProfile };
