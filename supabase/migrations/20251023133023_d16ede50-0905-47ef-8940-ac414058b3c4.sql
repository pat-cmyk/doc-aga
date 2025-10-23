-- Create farm_expenses table
CREATE TABLE farm_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false
);

-- Index for faster queries
CREATE INDEX idx_farm_expenses_farm_id ON farm_expenses(farm_id);
CREATE INDEX idx_farm_expenses_date ON farm_expenses(expense_date DESC);

-- Updated_at trigger
CREATE TRIGGER handle_farm_expenses_updated_at 
  BEFORE UPDATE ON farm_expenses
  FOR EACH ROW 
  EXECUTE FUNCTION handle_timestamp();

-- RLS Policies
ALTER TABLE farm_expenses ENABLE ROW LEVEL SECURITY;

-- Farm owners and members can view expenses
CREATE POLICY "Farm members can view expenses"
  ON farm_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM farms f
      LEFT JOIN farm_memberships fm ON fm.farm_id = f.id
      WHERE f.id = farm_expenses.farm_id 
        AND (f.owner_id = auth.uid() OR (fm.user_id = auth.uid() AND fm.invitation_status = 'accepted'))
    )
  );

-- Farm owners and managers can insert expenses
CREATE POLICY "Farm owners and managers can insert expenses"
  ON farm_expenses FOR INSERT
  WITH CHECK (
    is_farm_owner_or_manager(auth.uid(), farm_id)
  );

-- Farm owners and managers can update expenses
CREATE POLICY "Farm owners and managers can update expenses"
  ON farm_expenses FOR UPDATE
  USING (
    is_farm_owner_or_manager(auth.uid(), farm_id)
  );