// A scenario module that forgets to export `body` — used to assert the CLI's
// graceful "did not export a `body`" error. (Has `nodes` so the sweep loader's
// nodes check passes, isolating the missing-body failure.)

export const nodes = 3;
