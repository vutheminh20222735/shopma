import type { ShopDatabase } from '@database/index';
import { nowIso, todayYmd, toYmd } from '@server/shared/time';
import { grantAnniversary } from '@server/features/offers/server/offers';

const JOB = 'anniversary';
/** Cấp mã kỷ niệm cho khách đã tròn năm. Idempotent (duy nhất theo thành viên + mốc). */
export function runAnniversaryJob(db: ShopDatabase, now = new Date()) {
    // Chỉ lấy tài khoản tạo từ ~1 năm trở lên (lọc thô, hàm grant kiểm tra chính xác).
    const cutoff = new Date(now.getTime() - 360 * 86400000).toISOString();
    const members = db.prepare("SELECT * FROM members WHERE role='customer' AND active=1 AND demo=0 AND created_at!='' AND created_at<=?").bind(cutoff).all<any>().results;
    let granted = 0;
    for (const member of members) {
        try { if (grantAnniversary(db, member, now)) granted++; }
        catch (error) { console.error('anniversary job member failed', member.id, error); }
    }
    db.prepare('INSERT INTO job_runs (name,last_run_at) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET last_run_at=excluded.last_run_at').bind(JOB, nowIso(now)).run();
    return granted;
}
/** Chạy nếu hôm nay (giờ VN) chưa chạy — dùng cho "bù" khi server khởi động lại sau thời gian tắt. */
export function runAnniversaryIfDue(db: ShopDatabase, now = new Date()) {
    const last = db.prepare('SELECT last_run_at FROM job_runs WHERE name=?').bind(JOB).first<{ last_run_at: string }>();
    if (last && toYmd(last.last_run_at) === todayYmd(now)) return null;
    return runAnniversaryJob(db, now);
}
/** Catch-up lúc khởi động rồi kiểm tra mỗi giờ; qua ngày mới (giờ VN) thì chạy lại. */
export function startOfferJobs(db: ShopDatabase) {
    const tick = (label: string) => {
        try {
            const granted = runAnniversaryIfDue(db);
            if (granted !== null) console.log(`Job kỷ niệm (${label}): cấp ${granted} mã.`);
        } catch (error) { console.error('Job kỷ niệm lỗi', error); }
    };
    tick('khởi động');
    const timer = setInterval(() => tick('hằng ngày'), 3600000);
    timer.unref();
    return () => clearInterval(timer);
}
