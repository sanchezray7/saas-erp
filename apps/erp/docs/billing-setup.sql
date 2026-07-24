-- ============================================================
-- Sistema de facturación SaaS (dLocal + PayPal)
-- ============================================================

-- Precios configurables por plan
CREATE TABLE IF NOT EXISTS plan_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan text NOT NULL CHECK (plan IN ('starter', 'business')),
  interval text NOT NULL DEFAULT 'month' CHECK (interval IN ('month', 'year')),
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  active boolean NOT NULL DEFAULT true
);

INSERT INTO plan_prices (plan, interval, amount) VALUES
  ('starter', 'month', 49),
  ('starter', 'year', 539),
  ('business', 'month', 89),
  ('business', 'year', 979)
ON CONFLICT DO NOTHING;

-- Suscripciones activas
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'expired')),
  provider text NOT NULL CHECK (provider IN ('dlocal', 'paypal')),
  provider_subscription_id text,
  provider_customer_id text,
  interval text NOT NULL DEFAULT 'month' CHECK (interval IN ('month', 'year')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider_subscription_id);

-- Facturas / comprobantes de pago
CREATE TABLE IF NOT EXISTS billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id),
  provider text NOT NULL,
  provider_invoice_id text,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'paid'
    CHECK (status IN ('paid', 'unpaid', 'voided', 'refunded')),
  pdf_url text,
  period_start date,
  period_end date,
  paid_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_company ON billing_invoices(company_id);
