// Path & command safety for the local bridge. Pure functions, no Electron imports (testable).
const path = require('path');
const os = require('os');

const WIN_PROTECTED = ['C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\ProgramData', 'C:\\System Volume Information'];
const MAC_PROTECTED = ['/System', '/Library', '/Applications', '/usr', '/bin', '/sbin', '/etc', '/private', '/var', '/dev', '/cores', '/opt'];
const LINUX_PROTECTED = ['/bin', '/boot', '/dev', '/etc', '/lib', '/lib32', '/lib64', '/proc', '/sys', '/usr', '/var', '/root', '/sbin', '/opt', '/run', '/srv'];

function norm(p) {
  let r = path.resolve(p);
  if (process.platform === 'win32') r = r.toLowerCase();
  return r;
}

function protectedList() {
  if (process.platform === 'win32') {
    const extra = [process.env.SystemRoot, process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramData].filter(Boolean);
    return [...WIN_PROTECTED, ...extra];
  }
  return process.platform === 'darwin' ? MAC_PROTECTED : LINUX_PROTECTED;
}

function isInside(child, parent) {
  const rel = path.relative(norm(parent), norm(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function isFilesystemRoot(p) {
  const r = path.resolve(p);
  return path.parse(r).root === r;
}

/** True if modifying `p` (or deleting it) could harm the OS or the user's whole profile. */
function isProtectedPath(p) {
  if (isFilesystemRoot(p)) return true;
  if (norm(p) === norm(os.homedir())) return true;
  return protectedList().some((pp) => isInside(p, pp) || isInside(pp, p));
}

/** A workspace root itself must not be a system dir, drive root, or the home dir. */
function isAllowedRoot(p) {
  return !isProtectedPath(p);
}

function insideAnyRoot(p, roots) {
  return roots.some((r) => isInside(p, r));
}

// ---- git argument policy -------------------------------------------------
const GIT_ALLOWED = new Set([
  'status', 'diff', 'add', 'restore', 'reset', 'commit', 'push', 'pull', 'fetch', 'checkout', 'switch',
  'branch', 'merge', 'rebase', 'stash', 'log', 'show', 'remote', 'clone', 'init', 'rev-parse', 'config',
  'ls-files', 'clean', 'tag', 'cherry-pick', 'revert', 'blame',
]);
const GIT_BLOCKED_ARG = /^(-c|--config|--exec|--upload-pack|--receive-pack|--exec-path|--git-dir|--work-tree|-C)(=|$)/;

function validateGitArgs(args) {
  if (!Array.isArray(args) || !args.length || !args.every((a) => typeof a === 'string')) throw new Error('Bad git args');
  if (!GIT_ALLOWED.has(args[0])) throw new Error(`git ${args[0]} is not allowed`);
  if (args.some((a) => GIT_BLOCKED_ARG.test(a))) throw new Error('Blocked git option');
  if (args.some((a) => /^ext::/.test(a))) throw new Error('Blocked git transport');
  return args;
}

function validateName(name) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Name required');
  if (/[\\/]/.test(name) || name === '.' || name === '..') throw new Error('Invalid name');
  if (process.platform === 'win32' && /[<>:"|?*\x00-\x1f]|[. ]$/.test(name)) throw new Error('Invalid name');
  return name.trim();
}

// Commands that need a loud confirmation before the terminal runs them from a *programmatic* source
// (Run buttons, wizards). Typing into the terminal yourself is always an explicit user action.
const DANGEROUS_CMD = /(\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\*)|\bdel\s+\/[sq]|\bformat\s+[a-z]:|\bmkfs\b|:\(\)\s*\{|\bdd\s+if=.*of=\/dev|\bshutdown\b|\bRemove-Item\b.*-Recurse.*\b[A-Z]:\\\s*$)/i;
function isDangerousCommand(cmd) { return DANGEROUS_CMD.test(cmd); }

module.exports = { isProtectedPath, isAllowedRoot, insideAnyRoot, isInside, validateGitArgs, validateName, isDangerousCommand };
