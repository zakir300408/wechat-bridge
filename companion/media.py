"""Retrieve one message-linked image locally. No network calls or decrypted-file cache."""
import json
import base64
import hashlib
import re
import os
import sys

sys.path.insert(0, os.path.join(sys.argv[1], 'scripts'))
os.environ['WEFLOW_CACHE_ENABLED'] = '0'
try:
    from _utils import load_config, decrypt_lock
    from nt_decrypt import connect_encrypted_readonly
    import export_chat_html as media
    from image_quality import best_asset, preview

    def readonly(db, key, salt):
        return connect_encrypted_readonly(db, "x'%s%s'" % (key, salt))

    media.connect = readonly
    descriptor = json.load(sys.stdin)
    config = load_config()
    db = config.get('ntDbPath') or ''
    account = os.path.dirname(os.path.dirname(os.path.dirname(db)))
    if not db or not os.path.isfile(db):
        raise ValueError('Source unavailable')
    key = decrypt_lock(config.get('ntKey', ''))
    salt = config.get('ntSalt', '')
    passphrase = decrypt_lock(config.get('favPassphrase') or config.get('decryptKey') or '')
    talker = descriptor['conversation_id']
    local_id = int(descriptor['local_id'])
    server_id = int(descriptor.get('server_id') or 0)
    timestamp = int(descriptor['timestamp'])
    content = descriptor.get('content') or ''
    own_id = media.clean_account_wxid(config.get('wxid', ''))
    image_map = media.scan_nt_cache(os.path.join(account, 'cache'), talker, account, own_id)
    account_images = media.scan_account_media(account, own_id, talker)
    row = [local_id, server_id, 3, 0, 0, timestamp, 0, 0, content]
    resources = media.load_resource_media_map(account, key, salt, [row], {**image_map, **account_images}, passphrase)
    identifiers = list(dict.fromkeys((resources.get('server:%s' % server_id) or []) + media.extract_media_md5s(content)))
    wanted = [value for value in identifiers if re.fullmatch('[0-9a-fA-F]{32}', value)]
    assets = []
    conversation = os.path.realpath(os.path.join(account, 'msg', 'attach', hashlib.md5(talker.encode()).hexdigest()))
    account_real = os.path.realpath(account)
    v2_key = media.resolve_v2_media_key(account, own_id)
    if conversation.startswith(account_real + os.sep) and os.path.isdir(conversation):
        for month in os.listdir(conversation):
            if not re.fullmatch(r'\d{4}-\d{2}', month):
                continue
            for identifier in wanted:
                for suffix in ('.dat', '_h.dat', '_t.dat'):
                    candidate = os.path.realpath(os.path.join(conversation, month, 'Img', identifier + suffix))
                    if not candidate.startswith(conversation + os.sep) or not os.path.isfile(candidate):
                        continue
                    if os.path.getsize(candidate) > 8 * 1024 * 1024:
                        continue
                    with open(candidate, 'rb') as source:
                        raw = source.read(8 * 1024 * 1024 + 1)
                    mime = media.detect_mime_from_bytes(raw[:16])
                    decoded = (raw, mime) if mime else media.decode_wechat_media(raw[:64], candidate, v2_key)
                    if decoded and decoded[1] in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'):
                        assets.append({'data': decoded[0], 'mime': decoded[1], 'original': suffix in ('.dat', '_h.dat')})
    for identifier in wanted:
        for mapping in (image_map, account_images):
            value = mapping.get('md5:' + identifier)
            if value:
                assets.append({'data': base64.b64decode(value[0]), 'mime': value[1], 'original': False})
    hit = media.resolve_media(image_map, local_id, timestamp, content, wanted, server_id)
    if hit:
        assets.append({'data': base64.b64decode(hit[0]), 'mime': hit[1], 'original': False})
    selected = best_asset(assets)
    if not selected:
        print(json.dumps({'available': False, 'reason': 'No reliable local image copy is retrievable. Open/download the original in WeChat on this PC and retrieve the source message again.'}))
    else:
        display, display_mime, display_size = preview(selected['data'])
        small = max(selected['width'], selected['height']) <= 320
        print(json.dumps({'available': True, 'base64': base64.b64encode(display).decode(), 'mimeType': display_mime,
                          'original_base64': base64.b64encode(selected['data']).decode(), 'original_mimeType': selected['mime'],
                          'original_available': bool(selected['original']), 'source_width': selected['width'], 'source_height': selected['height'],
                          'preview_width': display_size[0], 'preview_height': display_size[1],
                          'quality': 'original_local_file' if selected['original'] else 'thumbnail_only' if small else 'cached_copy',
                          'preview': True, 'matched_by': 'message_resource' if wanted and selected['original'] else 'local_message_cache'}))

except Exception:
    print(json.dumps({'available': False, 'reason': 'Local image retrieval failed. No private keys or paths logged.'}))
    sys.exit(1)
