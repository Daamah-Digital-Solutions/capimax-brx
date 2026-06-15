export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      card_transactions: {
        Row: {
          amount: number
          card_id: string
          category: string | null
          created_at: string
          currency: string
          id: string
          merchant: string | null
          status: string
          tx_type: string
          user_id: string
        }
        Insert: {
          amount: number
          card_id: string
          category?: string | null
          created_at?: string
          currency?: string
          id?: string
          merchant?: string | null
          status?: string
          tx_type: string
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string
          category?: string | null
          created_at?: string
          currency?: string
          id?: string
          merchant?: string | null
          status?: string
          tx_type?: string
          user_id?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          authorized_signatory: string
          certificate_id: string
          created_at: string
          digital_signature_hash: string | null
          finalized_at: string | null
          id: string
          investment_amount: number
          investment_id: string | null
          investor_id_masked: string | null
          investor_name: string
          issue_date: string
          listing_id: string
          ownership_percentage: number
          pdf_path: string | null
          pdf_url: string | null
          platform_fee: number | null
          property_location: string | null
          property_name: string
          qr_code_data: string | null
          revocation_reason: string | null
          revoked_at: string | null
          spv_name: string
          spv_registration_ref: string | null
          status: Database["public"]["Enums"]["certificate_status"]
          subscription_date: string
          unit_price: number
          units_purchased: number
          updated_at: string
          user_id: string
          verification_code: string
          verification_url: string
        }
        Insert: {
          authorized_signatory?: string
          certificate_id: string
          created_at?: string
          digital_signature_hash?: string | null
          finalized_at?: string | null
          id?: string
          investment_amount: number
          investment_id?: string | null
          investor_id_masked?: string | null
          investor_name: string
          issue_date?: string
          listing_id: string
          ownership_percentage: number
          pdf_path?: string | null
          pdf_url?: string | null
          platform_fee?: number | null
          property_location?: string | null
          property_name: string
          qr_code_data?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          spv_name: string
          spv_registration_ref?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          subscription_date: string
          unit_price: number
          units_purchased: number
          updated_at?: string
          user_id: string
          verification_code: string
          verification_url: string
        }
        Update: {
          authorized_signatory?: string
          certificate_id?: string
          created_at?: string
          digital_signature_hash?: string | null
          finalized_at?: string | null
          id?: string
          investment_amount?: number
          investment_id?: string | null
          investor_id_masked?: string | null
          investor_name?: string
          issue_date?: string
          listing_id?: string
          ownership_percentage?: number
          pdf_path?: string | null
          pdf_url?: string | null
          platform_fee?: number | null
          property_location?: string | null
          property_name?: string
          qr_code_data?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          spv_name?: string
          spv_registration_ref?: string | null
          status?: Database["public"]["Enums"]["certificate_status"]
          subscription_date?: string
          unit_price?: number
          units_purchased?: number
          updated_at?: string
          user_id?: string
          verification_code?: string
          verification_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      family_accounts: {
        Row: {
          access_level: string
          allocated_returns_percent: number | null
          created_at: string
          id: string
          investor_id: string
          linked_at: string | null
          member_email: string
          member_name: string
          relationship: string
          status: string
          total_transferred: number | null
          updated_at: string
        }
        Insert: {
          access_level?: string
          allocated_returns_percent?: number | null
          created_at?: string
          id?: string
          investor_id: string
          linked_at?: string | null
          member_email: string
          member_name: string
          relationship: string
          status?: string
          total_transferred?: number | null
          updated_at?: string
        }
        Update: {
          access_level?: string
          allocated_returns_percent?: number | null
          created_at?: string
          id?: string
          investor_id?: string
          linked_at?: string | null
          member_email?: string
          member_name?: string
          relationship?: string
          status?: string
          total_transferred?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      family_bank_accounts: {
        Row: {
          account_holder_name: string
          account_number_masked: string
          bank_code: string | null
          bank_name: string
          created_at: string
          currency: string
          family_account_id: string
          iban_masked: string | null
          id: string
          is_primary: boolean | null
          is_verified: boolean | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          account_holder_name: string
          account_number_masked: string
          bank_code?: string | null
          bank_name: string
          created_at?: string
          currency?: string
          family_account_id: string
          iban_masked?: string | null
          id?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          account_holder_name?: string
          account_number_masked?: string
          bank_code?: string | null
          bank_name?: string
          created_at?: string
          currency?: string
          family_account_id?: string
          iban_masked?: string | null
          id?: string
          is_primary?: boolean | null
          is_verified?: boolean | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_bank_accounts_family_account_id_fkey"
            columns: ["family_account_id"]
            isOneToOne: false
            referencedRelation: "family_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      family_transactions: {
        Row: {
          amount: number | null
          bank_account_id: string | null
          created_at: string
          currency: string | null
          description: string | null
          family_account_id: string
          id: string
          initiated_by: string
          metadata: Json | null
          reference_number: string | null
          status: string
          transaction_type: string
        }
        Insert: {
          amount?: number | null
          bank_account_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          family_account_id: string
          id?: string
          initiated_by: string
          metadata?: Json | null
          reference_number?: string | null
          status?: string
          transaction_type: string
        }
        Update: {
          amount?: number | null
          bank_account_id?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          family_account_id?: string
          id?: string
          initiated_by?: string
          metadata?: Json | null
          reference_number?: string | null
          status?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "family_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_transactions_family_account_id_fkey"
            columns: ["family_account_id"]
            isOneToOne: false
            referencedRelation: "family_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      family_transfer_schedules: {
        Row: {
          bank_account_id: string
          created_at: string
          family_account_id: string
          id: string
          is_active: boolean | null
          next_transfer_date: string | null
          schedule_type: string
          threshold_amount: number | null
          updated_at: string
        }
        Insert: {
          bank_account_id: string
          created_at?: string
          family_account_id: string
          id?: string
          is_active?: boolean | null
          next_transfer_date?: string | null
          schedule_type: string
          threshold_amount?: number | null
          updated_at?: string
        }
        Update: {
          bank_account_id?: string
          created_at?: string
          family_account_id?: string
          id?: string
          is_active?: boolean | null
          next_transfer_date?: string | null
          schedule_type?: string
          threshold_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_transfer_schedules_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "family_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_transfer_schedules_family_account_id_fkey"
            columns: ["family_account_id"]
            isOneToOne: false
            referencedRelation: "family_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          amount_invested: number
          created_at: string
          id: string
          minted_at: string | null
          ownership_percentage: number
          payment_method: string
          payment_status: string
          price_per_token: number
          property_id: string
          property_name: string
          token_amount: number
          token_symbol: string
          tokens_minted: boolean
          updated_at: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount_invested: number
          created_at?: string
          id?: string
          minted_at?: string | null
          ownership_percentage: number
          payment_method: string
          payment_status?: string
          price_per_token: number
          property_id: string
          property_name: string
          token_amount: number
          token_symbol: string
          tokens_minted?: boolean
          updated_at?: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount_invested?: number
          created_at?: string
          id?: string
          minted_at?: string | null
          ownership_percentage?: number
          payment_method?: string
          payment_status?: string
          price_per_token?: number
          property_id?: string
          property_name?: string
          token_amount?: number
          token_symbol?: string
          tokens_minted?: boolean
          updated_at?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investments_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_bank_accounts: {
        Row: {
          account_holder_name: string
          account_number_masked: string
          bank_code: string | null
          bank_name: string
          country: string
          created_at: string
          currency: string
          iban_masked: string | null
          id: string
          is_default: boolean | null
          is_verified: boolean | null
          swift_code: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          account_holder_name: string
          account_number_masked: string
          bank_code?: string | null
          bank_name: string
          country: string
          created_at?: string
          currency?: string
          iban_masked?: string | null
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          swift_code?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          account_holder_name?: string
          account_number_masked?: string
          bank_code?: string | null
          bank_name?: string
          country?: string
          created_at?: string
          currency?: string
          iban_masked?: string | null
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          swift_code?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      investor_crypto_wallets: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          is_verified: boolean | null
          network: string
          updated_at: string
          user_id: string
          verified_at: string | null
          wallet_address: string
          wallet_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          network?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          wallet_address: string
          wallet_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          network?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          wallet_address?: string
          wallet_label?: string | null
        }
        Relationships: []
      }
      liquidity_providers: {
        Row: {
          annual_revenue: string | null
          applied_at: string
          approved_at: string | null
          bank_account_number: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_swift: string | null
          business_address: string | null
          business_description: string | null
          business_registration_number: string | null
          business_type: string | null
          company_name: string | null
          contact_name: string
          country: string | null
          created_at: string
          crypto_network: string | null
          crypto_wallet_address: string | null
          current_balance: number
          email: string
          id: string
          investment_amount: number
          kyb_approved_at: string | null
          kyb_rejected_at: string | null
          kyb_rejection_reason: string | null
          kyb_status: Database["public"]["Enums"]["kyb_status"]
          kyb_submitted_at: string | null
          phone: string | null
          rejected_at: string | null
          rejection_reason: string | null
          source_of_funds: string | null
          status: Database["public"]["Enums"]["lp_status"]
          tax_id: string | null
          total_deposited: number
          total_earnings: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_revenue?: string | null
          applied_at?: string
          approved_at?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          business_address?: string | null
          business_description?: string | null
          business_registration_number?: string | null
          business_type?: string | null
          company_name?: string | null
          contact_name: string
          country?: string | null
          created_at?: string
          crypto_network?: string | null
          crypto_wallet_address?: string | null
          current_balance?: number
          email: string
          id?: string
          investment_amount?: number
          kyb_approved_at?: string | null
          kyb_rejected_at?: string | null
          kyb_rejection_reason?: string | null
          kyb_status?: Database["public"]["Enums"]["kyb_status"]
          kyb_submitted_at?: string | null
          phone?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          source_of_funds?: string | null
          status?: Database["public"]["Enums"]["lp_status"]
          tax_id?: string | null
          total_deposited?: number
          total_earnings?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_revenue?: string | null
          applied_at?: string
          approved_at?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          business_address?: string | null
          business_description?: string | null
          business_registration_number?: string | null
          business_type?: string | null
          company_name?: string | null
          contact_name?: string
          country?: string | null
          created_at?: string
          crypto_network?: string | null
          crypto_wallet_address?: string | null
          current_balance?: number
          email?: string
          id?: string
          investment_amount?: number
          kyb_approved_at?: string | null
          kyb_rejected_at?: string | null
          kyb_rejection_reason?: string | null
          kyb_status?: Database["public"]["Enums"]["kyb_status"]
          kyb_submitted_at?: string | null
          phone?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          source_of_funds?: string | null
          status?: Database["public"]["Enums"]["lp_status"]
          tax_id?: string | null
          total_deposited?: number
          total_earnings?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lp_documents: {
        Row: {
          created_at: string
          document_name: string
          document_type: string
          file_path: string
          file_size: number | null
          id: string
          is_template: boolean
          lp_id: string | null
          uploaded_by: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type: string
          file_path: string
          file_size?: number | null
          id?: string
          is_template?: boolean
          lp_id?: string | null
          uploaded_by?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_template?: boolean
          lp_id?: string | null
          uploaded_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lp_documents_lp_id_fkey"
            columns: ["lp_id"]
            isOneToOne: false
            referencedRelation: "liquidity_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_holdings: {
        Row: {
          created_at: string
          current_value: number
          id: string
          listed_at: string | null
          listing_id: string | null
          lp_id: string
          property_id: string
          property_name: string
          purchase_date: string
          purchase_price: number
          sold_at: string | null
          status: string
          token_amount: number
          token_symbol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_value: number
          id?: string
          listed_at?: string | null
          listing_id?: string | null
          lp_id: string
          property_id: string
          property_name: string
          purchase_date?: string
          purchase_price: number
          sold_at?: string | null
          status?: string
          token_amount: number
          token_symbol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_value?: number
          id?: string
          listed_at?: string | null
          listing_id?: string | null
          lp_id?: string
          property_id?: string
          property_name?: string
          purchase_date?: string
          purchase_price?: number
          sold_at?: string | null
          status?: string
          token_amount?: number
          token_symbol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lp_holdings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "lp_market_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lp_holdings_lp_id_fkey"
            columns: ["lp_id"]
            isOneToOne: false
            referencedRelation: "liquidity_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_kyb_documents: {
        Row: {
          created_at: string
          document_name: string
          document_type: string
          file_path: string
          file_size: number | null
          id: string
          lp_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_name: string
          document_type: string
          file_path: string
          file_size?: number | null
          id?: string
          lp_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_name?: string
          document_type?: string
          file_path?: string
          file_size?: number | null
          id?: string
          lp_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lp_kyb_documents_lp_id_fkey"
            columns: ["lp_id"]
            isOneToOne: false
            referencedRelation: "liquidity_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_market_listings: {
        Row: {
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          investor_id: string
          listed_at: string
          lp_id: string | null
          net_amount: number
          notes: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          property_id: string
          property_name: string
          purchased_at: string | null
          status: string
          token_amount: number
          token_symbol: string
          total_value: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          investor_id: string
          listed_at?: string
          lp_id?: string | null
          net_amount: number
          notes?: string | null
          platform_fee_amount: number
          platform_fee_percent?: number
          property_id: string
          property_name: string
          purchased_at?: string | null
          status?: string
          token_amount: number
          token_symbol: string
          total_value: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          investor_id?: string
          listed_at?: string
          lp_id?: string | null
          net_amount?: number
          notes?: string | null
          platform_fee_amount?: number
          platform_fee_percent?: number
          property_id?: string
          property_name?: string
          purchased_at?: string | null
          status?: string
          token_amount?: number
          token_symbol?: string
          total_value?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lp_market_listings_lp_id_fkey"
            columns: ["lp_id"]
            isOneToOne: false
            referencedRelation: "liquidity_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      lp_transactions: {
        Row: {
          amount: number
          bank_reference: string | null
          created_at: string
          crypto_tx_hash: string | null
          currency: string
          id: string
          lp_id: string
          notes: string | null
          processed_at: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          tx_type: string
          withdrawal_method: string | null
        }
        Insert: {
          amount: number
          bank_reference?: string | null
          created_at?: string
          crypto_tx_hash?: string | null
          currency?: string
          id?: string
          lp_id: string
          notes?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          tx_type: string
          withdrawal_method?: string | null
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          created_at?: string
          crypto_tx_hash?: string | null
          currency?: string
          id?: string
          lp_id?: string
          notes?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          tx_type?: string
          withdrawal_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lp_transactions_lp_id_fkey"
            columns: ["lp_id"]
            isOneToOne: false
            referencedRelation: "liquidity_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_documents: {
        Row: {
          created_at: string
          description: string | null
          document_name: string
          document_type: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          property_id: string | null
          property_name: string | null
          status: string
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_name: string
          document_type: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          property_id?: string | null
          property_name?: string | null
          status?: string
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          document_name?: string
          document_type?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          property_id?: string | null
          property_name?: string | null
          status?: string
          updated_at?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ownership_tokens: {
        Row: {
          acquisition_date: string
          created_at: string
          id: string
          last_distribution_date: string | null
          ownership_percentage: number
          property_id: string
          property_name: string
          status: string
          token_amount: number
          token_symbol: string
          token_value_usd: number
          total_distributions: number
          updated_at: string
          wallet_id: string
        }
        Insert: {
          acquisition_date?: string
          created_at?: string
          id?: string
          last_distribution_date?: string | null
          ownership_percentage?: number
          property_id: string
          property_name: string
          status?: string
          token_amount?: number
          token_symbol: string
          token_value_usd?: number
          total_distributions?: number
          updated_at?: string
          wallet_id: string
        }
        Update: {
          acquisition_date?: string
          created_at?: string
          id?: string
          last_distribution_date?: string | null
          ownership_percentage?: number
          property_id?: string
          property_name?: string
          status?: string
          token_amount?: number
          token_symbol?: string
          token_value_usd?: number
          total_distributions?: number
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ownership_tokens_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          method_id: string | null
          method_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          method_id?: string | null
          method_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          method_id?: string | null
          method_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          card_brand: string
          card_expiry_month: number
          card_expiry_year: number
          card_last_four: string
          cardholder_name: string
          created_at: string
          id: string
          is_default: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_brand: string
          card_expiry_month: number
          card_expiry_year: number
          card_last_four: string
          cardholder_name: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_brand?: string
          card_expiry_month?: number
          card_expiry_year?: number
          card_last_four?: string
          cardholder_name?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pwa_settings: {
        Row: {
          app_description: string
          app_name: string
          app_short_name: string
          background_color: string
          created_at: string
          id: string
          install_prompt_enabled: boolean
          theme_color: string
          updated_at: string
        }
        Insert: {
          app_description?: string
          app_name?: string
          app_short_name?: string
          background_color?: string
          created_at?: string
          id?: string
          install_prompt_enabled?: boolean
          theme_color?: string
          updated_at?: string
        }
        Update: {
          app_description?: string
          app_name?: string
          app_short_name?: string
          background_color?: string
          created_at?: string
          id?: string
          install_prompt_enabled?: boolean
          theme_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      reinvestments: {
        Row: {
          created_at: string
          discount_amount: number
          discount_percentage: number
          id: string
          investment_id: string | null
          net_investment_value: number
          property_id: string
          property_name: string
          source_amount: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_amount: number
          discount_percentage?: number
          id?: string
          investment_id?: string | null
          net_investment_value: number
          property_id: string
          property_name: string
          source_amount: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discount_amount?: number
          discount_percentage?: number
          id?: string
          investment_id?: string | null
          net_investment_value?: number
          property_id?: string
          property_name?: string
          source_amount?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reinvestments_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      secondary_market_listings: {
        Row: {
          buyer_id: string | null
          buyer_type: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          id: string
          listed_at: string
          net_amount: number
          notes: string | null
          platform_fee_amount: number
          platform_fee_percent: number
          property_id: string
          property_name: string
          purchased_at: string | null
          seller_id: string
          seller_type: string
          status: string
          token_amount: number
          token_symbol: string
          total_value: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          buyer_id?: string | null
          buyer_type?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          listed_at?: string
          net_amount: number
          notes?: string | null
          platform_fee_amount: number
          platform_fee_percent?: number
          property_id: string
          property_name: string
          purchased_at?: string | null
          seller_id: string
          seller_type?: string
          status?: string
          token_amount: number
          token_symbol: string
          total_value: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string | null
          buyer_type?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          listed_at?: string
          net_amount?: number
          notes?: string | null
          platform_fee_amount?: number
          platform_fee_percent?: number
          property_id?: string
          property_name?: string
          purchased_at?: string | null
          seller_id?: string
          seller_type?: string
          status?: string
          token_amount?: number
          token_symbol?: string
          total_value?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_kyc: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          rejected_at: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_wallets: {
        Row: {
          created_at: string
          id: string
          network: string
          updated_at: string
          user_id: string
          wallet_address: string
          wallet_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          network?: string
          updated_at?: string
          user_id: string
          wallet_address: string
          wallet_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          network?: string
          updated_at?: string
          user_id?: string
          wallet_address?: string
          wallet_type?: string
        }
        Relationships: []
      }
      visa_cards: {
        Row: {
          card_brand: string
          card_category: string
          card_last_four: string
          card_number_masked: string
          card_type: string
          cardholder_name: string | null
          created_at: string
          expiry_month: number
          expiry_year: number
          family_account_id: string | null
          id: string
          nickname: string | null
          relationship: string | null
          role_at_issue: string | null
          shipping_status: string | null
          spending_limit: number
          spent_this_month: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_brand?: string
          card_category?: string
          card_last_four: string
          card_number_masked: string
          card_type: string
          cardholder_name?: string | null
          created_at?: string
          expiry_month?: number
          expiry_year?: number
          family_account_id?: string | null
          id?: string
          nickname?: string | null
          relationship?: string | null
          role_at_issue?: string | null
          shipping_status?: string | null
          spending_limit?: number
          spent_this_month?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_brand?: string
          card_category?: string
          card_last_four?: string
          card_number_masked?: string
          card_type?: string
          cardholder_name?: string | null
          created_at?: string
          expiry_month?: number
          expiry_year?: number
          family_account_id?: string | null
          id?: string
          nickname?: string | null
          relationship?: string | null
          role_at_issue?: string | null
          shipping_status?: string | null
          spending_limit?: number
          spent_this_month?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visa_cards_family_account_id_fkey"
            columns: ["family_account_id"]
            isOneToOne: false
            referencedRelation: "family_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_balances: {
        Row: {
          available_balance: number
          created_at: string
          currency: string
          pending_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          currency?: string
          pending_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          currency?: string
          pending_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number | null
          block_number: number | null
          created_at: string
          id: string
          status: string
          token_symbol: string | null
          tx_hash: string
          tx_type: string
          wallet_id: string
        }
        Insert: {
          amount?: number | null
          block_number?: number | null
          created_at?: string
          id?: string
          status?: string
          token_symbol?: string | null
          tx_hash: string
          tx_type: string
          wallet_id: string
        }
        Update: {
          amount?: number | null
          block_number?: number | null
          created_at?: string
          id?: string
          status?: string
          token_symbol?: string | null
          tx_hash?: string
          tx_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "user_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_otps: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          user_id: string
          verified: boolean
          withdrawal_request_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          user_id: string
          verified?: boolean
          withdrawal_request_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
          verified?: boolean
          withdrawal_request_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          bank_account_id: string | null
          card_id: string | null
          completed_at: string | null
          created_at: string
          crypto_wallet_id: string | null
          currency: string
          failed_at: string | null
          failure_reason: string | null
          id: string
          notes: string | null
          otp_verified: boolean | null
          otp_verified_at: string | null
          processed_at: string | null
          reference_number: string | null
          status: string
          updated_at: string
          user_id: string
          withdrawal_method: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          card_id?: string | null
          completed_at?: string | null
          created_at?: string
          crypto_wallet_id?: string | null
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          notes?: string | null
          otp_verified?: boolean | null
          otp_verified_at?: string | null
          processed_at?: string | null
          reference_number?: string | null
          status?: string
          updated_at?: string
          user_id: string
          withdrawal_method: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          card_id?: string | null
          completed_at?: string | null
          created_at?: string
          crypto_wallet_id?: string | null
          currency?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          notes?: string | null
          otp_verified?: boolean | null
          otp_verified_at?: string | null
          processed_at?: string | null
          reference_number?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          withdrawal_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "investor_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_crypto_wallet_id_fkey"
            columns: ["crypto_wallet_id"]
            isOneToOne: false
            referencedRelation: "investor_crypto_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      spend_with_card: {
        Args: {
          _amount: number
          _card_id: string
          _category?: string
          _merchant?: string
        }
        Returns: {
          amount: number
          card_id: string
          category: string | null
          created_at: string
          currency: string
          id: string
          merchant: string | null
          status: string
          tx_type: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "card_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      topup_wallet: {
        Args: { _amount: number }
        Returns: {
          available_balance: number
          created_at: string
          currency: string
          pending_balance: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_balances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      verify_certificate: {
        Args: { p_code: string }
        Returns: {
          authorized_signatory: string
          certificate_id: string
          digital_signature_hash: string
          finalized_at: string
          investment_amount: number
          investor_id_masked: string
          investor_name: string
          issue_date: string
          listing_id: string
          ownership_percentage: number
          platform_fee: number
          property_location: string
          property_name: string
          revocation_reason: string
          spv_name: string
          spv_registration_ref: string
          status: Database["public"]["Enums"]["certificate_status"]
          subscription_date: string
          unit_price: number
          units_purchased: number
          verification_code: string
          verification_url: string
        }[]
      }
    }
    Enums: {
      certificate_status: "provisional" | "final" | "revoked"
      kyb_status:
        | "not_started"
        | "documents_pending"
        | "under_review"
        | "approved"
        | "rejected"
      kyc_status: "pending" | "submitted" | "approved" | "rejected"
      lp_status: "pending" | "approved" | "rejected" | "suspended"
      withdrawal_status: "pending" | "processing" | "completed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      certificate_status: ["provisional", "final", "revoked"],
      kyb_status: [
        "not_started",
        "documents_pending",
        "under_review",
        "approved",
        "rejected",
      ],
      kyc_status: ["pending", "submitted", "approved", "rejected"],
      lp_status: ["pending", "approved", "rejected", "suspended"],
      withdrawal_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const
