import { randomUUID } from 'node:crypto';
import { database } from '@server/shared/database';
import { ShopError } from '@server/shared/errors';
import { hashPassword, validatePassword } from './passwords';
import { nowIso } from '@server/shared/time';

// Called by the local setup command, never exposed as an HTTP endpoint.
export async function createOwner(input: {name: string; email: string; password: string}) {
    const db = database();
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new ShopError('Tên hoặc email chủ shop không hợp lệ.');
    const owner = db.prepare("SELECT owner_id FROM shop WHERE id='main'").first<{owner_id:string}>();
    if (owner?.owner_id) throw new ShopError('Chủ shop đã được tạo. Lệnh setup không thay đổi tài khoản hiện có.');
    if (db.prepare('SELECT id FROM members WHERE email=?').bind(email).first()) throw new ShopError('Email này đã được đăng ký. Hãy chọn email chủ shop khác.');
    const passwordHash = await hashPassword(validatePassword(input.password));
    const id = randomUUID();
        db.batch([
            db.prepare('INSERT INTO members (id,name,email,role,active,demo,created_at) VALUES (?,?,?,\'admin\',1,0,?)').bind(id,name,email,nowIso()),
            db.prepare('INSERT INTO credentials (member_id,password_hash,password_plain) VALUES (?,?,?)').bind(id,passwordHash,input.password),
            db.prepare("UPDATE shop SET owner_id=? WHERE id='main' AND owner_id=''").bind(id),
        ]);
    return {id, name, email};
}
