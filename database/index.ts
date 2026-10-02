import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { config } from '@server/shared/config';

export class PreparedQuery {
    constructor(private readonly db: ShopDatabase, private readonly sql: string, private readonly values: SQLInputValue[] = []) {}
    bind(...values: SQLInputValue[]) { return new PreparedQuery(this.db, this.sql, values); }
    first<T = any>(): T | null { return (this.db.raw.prepare(this.sql).get(...this.values) as T | undefined) ?? null; }
    all<T = any>() { return { results: this.db.raw.prepare(this.sql).all(...this.values) as T[] }; }
    run() {
        const result = this.db.raw.prepare(this.sql).run(...this.values);
        return { meta: { changes: Number(result.changes) } };
    }
}

export class ShopDatabase {
    readonly raw: DatabaseSync;
    constructor(filename: string) {
        if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
        this.raw = new DatabaseSync(filename);
        this.raw.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
        this.migrate();
        this.raw.prepare("INSERT OR IGNORE INTO shop (id,owner_id) VALUES ('main','')").run();
    }
    prepare(sql: string) { return new PreparedQuery(this, sql); }
    batch(statements: PreparedQuery[]) {
        this.raw.exec('BEGIN IMMEDIATE');
        try {
            const result = statements.map(statement => statement.run());
            this.raw.exec('COMMIT');
            return result;
        } catch (error) { this.raw.exec('ROLLBACK'); throw error; }
    }
    migrate() {
        this.raw.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
        const folder = path.join(config.projectRoot, 'database/migrations');
        for (const name of readdirSync(folder).filter(name => /^\d+_.+\.sql$/.test(name)).sort()) {
            if (this.raw.prepare('SELECT name FROM schema_migrations WHERE name=?').get(name)) continue;
            this.raw.exec('BEGIN IMMEDIATE');
            try {
                this.raw.exec(readFileSync(path.join(folder, name), 'utf8'));
                this.raw.prepare('INSERT INTO schema_migrations (name,applied_at) VALUES (?,?)').run(name, new Date().toISOString());
                this.raw.exec('COMMIT');
            } catch (error) { this.raw.exec('ROLLBACK'); throw error; }
        }
    }
    close() { this.raw.close(); }
}
let instance: ShopDatabase | undefined;
export function getDb() { return instance ??= new ShopDatabase(config.databasePath); }
