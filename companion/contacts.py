"""Read the configured contact index in place; never write or expose database keys."""
import json
import os
import sys

sys.path.insert(0, os.path.join(sys.argv[1], 'scripts'))
os.environ['WEFLOW_CACHE_ENABLED'] = '0'
try:
    from _utils import get_db_config
    from nt_decrypt import connect_encrypted_readonly
    cfg = get_db_config()
    if not all(cfg.get(k) for k in ('contact_db', 'contact_key', 'contact_salt')):
        raise ValueError('Contact index unavailable')
    conn, cursor = connect_encrypted_readonly(cfg['contact_db'], "x'%s%s'" % (cfg['contact_key'], cfg['contact_salt']))
    try:
        columns = [r[1] for r in cursor.execute('PRAGMA table_info(contact)').fetchall()]
        if '--schema' in sys.argv:
            print(json.dumps({'columns': columns}))
            sys.exit(0)
        selected = [c for c in columns if c in ('username', 'alias', 'remark', 'nick_name') or any(s in c.lower() for s in ('pin_yin', 'pinyin', 'quan_pin', 'py_initial', 'full_py'))]
        sql = 'SELECT ' + ','.join('"' + c.replace('"', '""') + '"' for c in selected) + ' FROM contact'
        contacts = []
        for row in cursor.execute(sql):
            item = dict(zip(selected, row))
            if not item.get('username'):
                continue
            contacts.append({'id': item['username'], 'wechat_id': item.get('alias') or '', 'remark': item.get('remark') or '', 'nickname': item.get('nick_name') or '', 'pinyin': [v for k, v in item.items() if k not in ('username', 'alias', 'remark', 'nick_name') and isinstance(v, str) and v]})
        print(json.dumps({'available': True, 'contacts': contacts}, ensure_ascii=False))
    finally:
        conn.close()
except Exception:
    print(json.dumps({'available': False, 'contacts': [], 'reason': 'Local contact index unavailable'}))
    sys.exit(1)
