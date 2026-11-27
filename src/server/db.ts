import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let dbInstance: Database.Database | null = null;

export function getDbPath(): string {
  if (process.env.KPATA_DB_PATH) {
    return process.env.KPATA_DB_PATH;
  }
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'kpata.db');
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  dbInstance = db;
  return db;
}

/** Used in tests to isolate an in-memory or temporary DB */
export function resetDbForTests(customPath?: string): Database.Database {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  if (customPath) {
    process.env.KPATA_DB_PATH = customPath;
  }
  return getDb();
}

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      email_verified INTEGER NOT NULL DEFAULT 0,
      preferred_lang TEXT NOT NULL DEFAULT 'fr',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT,
      ip_hash TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'FAMILLE',
      description TEXT,
      country TEXT NOT NULL DEFAULT 'BJ',
      currency TEXT NOT NULL DEFAULT 'XOF',
      timezone TEXT NOT NULL DEFAULT 'Africa/Porto-Novo',
      visibility TEXT NOT NULL DEFAULT 'PRIVATE',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      family_relation TEXT,
      role TEXT NOT NULL DEFAULT 'MEMBER',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      is_external INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_invitations (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      invited_by TEXT NOT NULL REFERENCES users(id),
      email TEXT,
      phone TEXT,
      token TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'MEMBER',
      status TEXT NOT NULL DEFAULT 'PENDING',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS member_link_requests (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      verification_contact TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY,
      group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      amount_int INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'XOF',
      expense_date TEXT NOT NULL,
      category_id TEXT REFERENCES expense_categories(id),
      scope TEXT NOT NULL DEFAULT 'COLLECTIVE',
      split_method TEXT NOT NULL DEFAULT 'EQUAL',
      payment_status TEXT NOT NULL DEFAULT 'PAID',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_freq TEXT,
      next_occurrence TEXT,
      created_by_member_id TEXT NOT NULL REFERENCES group_members(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expense_payers (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES group_members(id),
      amount_paid_int INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expense_shares (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES group_members(id),
      share_amount_int INTEGER NOT NULL,
      weight_or_pct_num INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS expense_comments (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES group_members(id),
      user_id TEXT REFERENCES users(id),
      content TEXT NOT NULL,
      is_dispute INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expense_revisions (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      changed_by_user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contribution_plans (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      objective TEXT,
      target_amount_int INTEGER NOT NULL,
      amount_per_member_int INTEGER NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'ONCE',
      start_date TEXT NOT NULL,
      due_date TEXT,
      currency TEXT NOT NULL DEFAULT 'XOF',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contributions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES contribution_plans(id) ON DELETE CASCADE,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES group_members(id),
      expected_amount_int INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'EXPECTED'
    );

    CREATE TABLE IF NOT EXISTS contribution_payments (
      id TEXT PRIMARY KEY,
      contribution_id TEXT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
      amount_int INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      reference TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'DECLARED',
      declared_by_user_id TEXT REFERENCES users(id),
      confirmed_by_user_id TEXT REFERENCES users(id),
      dispute_reason TEXT,
      created_at TEXT NOT NULL,
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      from_member_id TEXT NOT NULL REFERENCES group_members(id),
      to_member_id TEXT NOT NULL REFERENCES group_members(id),
      amount_int INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'XOF',
      settlement_date TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      reference TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      dispute_reason TEXT,
      declared_by_user_id TEXT REFERENCES users(id),
      confirmed_by_user_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES expense_categories(id),
      name TEXT NOT NULL,
      period_type TEXT NOT NULL DEFAULT 'MONTHLY',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      limit_amount_int INTEGER NOT NULL,
      alert_thresholds_json TEXT NOT NULL DEFAULT '[50,75,90,100]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      target_amount_int INTEGER NOT NULL,
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS savings_contributions (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES group_members(id),
      amount_int INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'DECLARED',
      note TEXT,
      created_at TEXT NOT NULL,
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_key TEXT NOT NULL,
      uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      in_app INTEGER NOT NULL DEFAULT 1,
      email INTEGER NOT NULL DEFAULT 1,
      push_web INTEGER NOT NULL DEFAULT 0,
      sms INTEGER NOT NULL DEFAULT 0,
      whatsapp INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS subscription_plans (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      monthly_price_int INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'XOF',
      max_members INTEGER,
      features_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL UNIQUE REFERENCES groups(id) ON DELETE CASCADE,
      plan_code TEXT NOT NULL REFERENCES subscription_plans(code),
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      start_date TEXT NOT NULL,
      end_date TEXT,
      auto_renew INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscription_requests (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      requested_by_user_id TEXT NOT NULL REFERENCES users(id),
      plan_code TEXT NOT NULL REFERENCES subscription_plans(code),
      months INTEGER NOT NULL DEFAULT 1,
      amount_int INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'XOF',
      payment_channel TEXT NOT NULL,
      reference TEXT,
      proof_note TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      admin_comment TEXT,
      reviewed_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS payment_transactions (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      subscription_request_id TEXT REFERENCES subscription_requests(id),
      plan_code TEXT NOT NULL,
      months INTEGER NOT NULL DEFAULT 1,
      provider TEXT NOT NULL,
      provider_tx_id TEXT UNIQUE,
      idempotency_key TEXT NOT NULL UNIQUE,
      amount_int INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'XOF',
      payment_method TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      raw_payload_json TEXT,
      verified_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'INFO',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details_json TEXT,
      ip_hash TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW',
      created_at TEXT NOT NULL
    );

    -- First-party privacy-safe site traffic analytics (bot-filtered)
    CREATE TABLE IF NOT EXISTS site_sessions (
      id TEXT PRIMARY KEY,
      visitor_hash TEXT NOT NULL,
      source_category TEXT NOT NULL DEFAULT 'Direct',
      referrer_host TEXT,
      landing_path TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'Bénin',
      city TEXT NOT NULL DEFAULT 'Abomey-Calavi',
      device_type TEXT NOT NULL DEFAULT 'Desktop',
      browser TEXT NOT NULL DEFAULT 'Chrome',
      duration_sec INTEGER NOT NULL DEFAULT 0,
      engaged INTEGER NOT NULL DEFAULT 0,
      pageviews_count INTEGER NOT NULL DEFAULT 1,
      started_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_pageviews (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES site_sessions(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      title TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id, expense_date);
    CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_site_sessions_started ON site_sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_site_sessions_last_seen ON site_sessions(last_seen_at);
    CREATE INDEX IF NOT EXISTS idx_site_pageviews_path ON site_pageviews(path);
  `);
}
