// library.js - job type "library": a set made only of sheets of library details (sheet type "details").
// It draws nothing of its own, so the set needs no geometry: give "geometry": { "units": "in" }.
'use strict';
const JOB = { type: 'library', derive: () => ({}), picture: () => '', field: {} };
