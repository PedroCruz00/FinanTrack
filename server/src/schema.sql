-- FinanTrack · esquema MySQL
-- Los ids de transactions, budgets y receipts son UUID generados en el dispositivo,
-- lo que permite crear registros sin conexión y reenviarlos sin duplicarlos.

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS categories (
  id         VARCHAR(40) NOT NULL PRIMARY KEY,
  name       VARCHAR(60) NOT NULL,
  type       ENUM('income', 'expense') NOT NULL,
  icon       VARCHAR(16) NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id                CHAR(36)      NOT NULL PRIMARY KEY,
  user_id           CHAR(36)      NOT NULL,
  category_id       VARCHAR(40)   NOT NULL,
  type              ENUM('income', 'expense') NOT NULL,
  amount            DECIMAL(14,2) NOT NULL,
  date              DATE          NOT NULL,
  description       VARCHAR(255)  NULL,
  payment_method    VARCHAR(30)   NULL,
  merchant          VARCHAR(120)  NULL,
  deleted           TINYINT(1)    NOT NULL DEFAULT 0,
  client_updated_at DATETIME(3)   NOT NULL,
  server_updated_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_tx_user     FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tx_category FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_tx_user_sync (user_id, server_updated_at),
  INDEX idx_tx_user_date (user_id, date)
);

CREATE TABLE IF NOT EXISTS budgets (
  id                CHAR(36)      NOT NULL PRIMARY KEY,
  user_id           CHAR(36)      NOT NULL,
  category_id       VARCHAR(40)   NULL, -- NULL = presupuesto general
  amount_limit      DECIMAL(14,2) NOT NULL,
  period            ENUM('weekly', 'monthly', 'yearly') NOT NULL,
  alert_percent     TINYINT UNSIGNED NOT NULL DEFAULT 80,
  deleted           TINYINT(1)    NOT NULL DEFAULT 0,
  client_created_at DATETIME(3)   NOT NULL,
  client_updated_at DATETIME(3)   NOT NULL,
  server_updated_at DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_budget_user     FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_budget_category FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_budget_user_sync (user_id, server_updated_at)
);

CREATE TABLE IF NOT EXISTS receipts (
  id                CHAR(36)     NOT NULL PRIMARY KEY,
  user_id           CHAR(36)     NOT NULL,
  transaction_id    CHAR(36)     NOT NULL,
  file_path         VARCHAR(255) NOT NULL,
  mime_type         VARCHAR(40)  NOT NULL,
  size_bytes        INT UNSIGNED NOT NULL,
  file_hash         CHAR(64)     NOT NULL,
  description       VARCHAR(255) NULL,
  captured_at       DATETIME(3)  NOT NULL,
  deleted           TINYINT(1)   NOT NULL DEFAULT 0,
  client_updated_at DATETIME(3)  NOT NULL,
  server_updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_receipt_user FOREIGN KEY (user_id)        REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_receipt_tx   FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  INDEX idx_receipt_user_sync (user_id, server_updated_at)
);

-- Registro de operaciones ya aplicadas: garantiza idempotencia.
-- Si el cliente reenvía una operación con el mismo op_id, se devuelve el resultado guardado.
CREATE TABLE IF NOT EXISTS processed_operations (
  op_id        CHAR(36)    NOT NULL PRIMARY KEY,
  user_id      CHAR(36)    NOT NULL,
  entity       VARCHAR(20) NOT NULL,
  action       VARCHAR(10) NOT NULL,
  result       JSON        NOT NULL,
  processed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_op_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Suscripciones Web Push (una por navegador/dispositivo)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id    CHAR(36)     NOT NULL,
  endpoint   VARCHAR(500) NOT NULL UNIQUE,
  p256dh     VARCHAR(200) NOT NULL,
  auth       VARCHAR(100) NOT NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
