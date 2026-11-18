'use strict';
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('GitHack transient midstream disconnects are retried without accepting unverified bytes', () => {
  execFileSync('python3', ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_integrity_transport.py'], {
    cwd: path.join(__dirname, '..'), stdio: 'pipe', timeout: 15000
  });
});
