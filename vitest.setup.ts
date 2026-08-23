// jest-dom was already a devDependency but never wired in, so `toBeInTheDocument`,
// `toHaveAccessibleName` and friends silently failed as "not a function".
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library unmounts between tests only when it can find a global
// `afterEach`, which needs `globals: true` — this project does not set it, so
// nothing was ever unmounted. Existing tests avoided the consequences by
// querying their own `container` rather than the whole document; the first test
// to reach for `screen` found every render the file had ever done.
afterEach(cleanup);
