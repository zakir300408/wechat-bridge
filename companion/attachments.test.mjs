import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAttachments, attachmentToolResult } from './attachments.mjs';
test('file handles are message scoped, reject traversal and changed files, and keep downloads available when text extraction fails', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wechat-attachment-test-')),
    timestamp = Math.floor(Date.now() / 1000),
    month = new Date(timestamp * 1000 + 8 * 3600000).toISOString().slice(0, 7),
    folder = path.join(root, 'account/msg/file', month);
  await fs.mkdir(folder, { recursive: true });
  const api = createAttachments({
    cfg: { python: process.execPath },
    root,
    configService: { get: (name) => (name === 'dbPath' ? root : 'account') },
    pythonCommand: () => process.execPath,
    pythonEnv: () => process.env,
  });
  try {
    await fs.writeFile(path.join(folder, 'test.txt'), 'hello attachment');
    const handle = await api.fromMessage(
      { localType: 49, mediaFileName: 'test.txt', createTime: timestamp },
      'wxid_fixture',
    );
    assert.equal(handle.available, true);
    assert.equal((await api.read({ attachment_id: handle.id })).text, 'hello attachment');
    const bytes = await api.read({
      attachment_id: handle.id,
      format: 'binary',
      byte_offset: 6,
      max_bytes: 10,
    });
    assert.equal(Buffer.from(bytes.base64, 'base64').toString(), 'attachment');
    assert.equal(
      await api.fromMessage(
        { localType: 49, mediaFileName: '../config.json', createTime: timestamp },
        'wxid_fixture',
      ),
      null,
    );
    await assert.rejects(api.read({ attachment_id: '../../config.json' }));
    await fs.writeFile(path.join(folder, 'test.txt'), 'changed');
    await assert.rejects(api.read({ attachment_id: handle.id, format: 'download' }));
    await fs.writeFile(path.join(folder, 'broken.pdf'), 'not a PDF');
    const pdf = await api.fromMessage(
      { localType: 49, mediaFileName: 'broken.pdf', createTime: timestamp },
      'wxid_fixture',
    );
    const result = await api.read({ attachment_id: pdf.id });
    assert.equal(result.available, true);
    assert.equal(result.extraction, 'unavailable');
    assert.equal(result._download.id, pdf.id);
    const image = await api.fromMessage(
      { localType: 3, localId: 1, serverId: '2', createTime: timestamp },
      'wxid_fixture',
    );
    assert.equal(image.kind, 'image');
    assert.ok(image.id);
    assert.equal(image.available, null);
    const tool = attachmentToolResult({
      _image: { data: 'Zml4dHVyZQ==', mimeType: 'image/jpeg' },
      _download: { id: image.id },
      available: true,
    });
    assert.equal(tool.content[1].type, 'image');
    assert.equal(JSON.parse(tool.content[0].text)._image, undefined);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
