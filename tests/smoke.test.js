import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('German static entry exists',()=>assert.match(readFileSync('index.html','utf8'),/lang="de"/));
