// The app's version comes from git: main carries a tag such as v1.0.0, and
// every merge to main after it adds one to the last number. `git describe`
// says that as "v1.0.0-3-gabc1234", which is version 1.0.3. A new major or
// minor version is just a new tag.
export function versionFromDescribe(describe: string): string | null {
  const match = describe
    .trim()
    .match(/^v(\d+)\.(\d+)\.(\d+)(?:-(\d+)-g[0-9a-f]+)?$/);
  if (!match) return null;
  const [, major, minor, patch, since = "0"] = match;
  return `${major}.${minor}.${Number(patch) + Number(since)}`;
}
