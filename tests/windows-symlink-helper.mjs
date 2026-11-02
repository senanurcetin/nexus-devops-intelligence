import { symlink } from 'node:fs/promises';

/**
 * Keep file-symlink security assertions mandatory on supported hosts.
 * An unprivileged Windows token may lack SeCreateSymbolicLinkPrivilege.
 * Only that exact platform/capability failure skips this one subtest;
 * malformed/oversize/hash/path assertions in the parent test still run.
 */
export async function assertFileSymlinkRejected(t, target, linkPath, verify) {
  await t.test('rejects a file symlink', async subtest => {
    try {
      await symlink(target, linkPath, 'file');
    } catch (error) {
      if (process.platform === 'win32' && error?.code === 'EPERM') {
        subtest.skip('Windows file symlink creation unavailable to this user; rejection not verified');
        return;
      }
      throw error;
    }
    await verify(linkPath);
  });
}
