export type MpBalance = {
  available_balance: number;
  unavailable_balance: number;
  total_amount: number;
};

export type MpCofrinho = {
  name: string;
  amount: number;
  currency_id: string;
};

export type MpMovement = {
  id: number;
  date: string;
  type: string;
  action: string;
  amount: number;
  currency_id: string;
  description: string;
  origin_id: number | null;
  origin_type: string | null;
  status: string;
};

export type MpMovementsResponse = {
  paging: { total: number; limit: number; offset: number };
  results: MpMovement[];
};

export type MpPayment = {
  id: number;
  date_created: string;
  date_approved: string | null;
  status: string;
  status_detail: string;
  payment_type_id: string;
  operation_type: string;
  description: string | null;
  transaction_amount: number;
  currency_id: string;
  payer: {
    id: number | null;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
  amounts?: {
    collector?: {
      transaction_destination?: {
        subpartition?: {
          name: string;
          amount: number;
        };
      };
    };
  };
};

export type MpPaymentsResponse = {
  paging: { total: number; limit: number; offset: number };
  results: MpPayment[];
};

export type MpMoneyBox = {
  id: string;
  name: string;
  goal_amount: number | null;
  current_amount: number;
  currency_id: string;
  created_date: string;
  status: string;
};

export type MpMoneyBoxesResponse = {
  money_boxes: MpMoneyBox[];
};

export type MpAccountData = {
  balance: MpBalance | null;
  recentPayments: MpPayment[];
  cofrinhos: MpCofrinho[];
  movementsTotal: number;
  movements: MpMovement[];
  moneyBoxes: MpMoneyBox[];
};
