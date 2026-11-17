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

// Whether two versions share a release: the same major and minor number, so
// they differ by merges only. Moving between them keeps the device's sign-in
// and offline copy; a new tag (major or minor) starts afresh.
export function sameRelease(a: string, b: string): boolean {
  const release = (v: string) => v.match(/^(\d+)\.(\d+)\.\d+$/)?.slice(1, 3);
  const [ra, rb] = [release(a), release(b)];
  return !!ra && !!rb && ra[0] === rb[0] && ra[1] === rb[1];
}
