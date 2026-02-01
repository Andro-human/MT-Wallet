import { supabase } from '@/integrations/supabase/client';
import { format, subDays, subHours } from 'date-fns';

interface CategoryInfo {
  slug: string;
  name: string;
}

interface SampleTransaction {
  merchant: string;
  merchant_normalized: string;
  amount: number;
  direction: 'credit' | 'debit';
  payment_method: string;
  account_last4: string;
  bank_name: string;
  categorySlug: string;
  daysAgo: number;
  hoursAgo?: number;
  raw_sms?: string;
}

const sampleTransactions: SampleTransaction[] = [
  // Food & Dining
  { merchant: 'Swiggy', merchant_normalized: 'swiggy', amount: 458, direction: 'debit', payment_method: 'UPI', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'food', daysAgo: 0, hoursAgo: 2, raw_sms: 'INR 458.00 debited from A/c X8834 on 01-Feb via UPI-Swiggy' },
  { merchant: 'Zomato', merchant_normalized: 'zomato', amount: 675, direction: 'debit', payment_method: 'UPI', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'food', daysAgo: 1, raw_sms: 'INR 675.00 debited from A/c X8834 via UPI-Zomato' },
  { merchant: 'Starbucks', merchant_normalized: 'starbucks', amount: 520, direction: 'debit', payment_method: 'Card', account_last4: '4521', bank_name: 'ICICI', categorySlug: 'food', daysAgo: 3 },
  { merchant: 'McDonalds', merchant_normalized: 'mcdonalds', amount: 389, direction: 'debit', payment_method: 'UPI', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'food', daysAgo: 5 },
  { merchant: 'Dominos Pizza', merchant_normalized: 'dominos', amount: 899, direction: 'debit', payment_method: 'Card', account_last4: '4521', bank_name: 'ICICI', categorySlug: 'food', daysAgo: 8 },
  { merchant: 'Swiggy', merchant_normalized: 'swiggy', amount: 342, direction: 'debit', payment_method: 'UPI', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'food', daysAgo: 12 },
  
  // Transport
  { merchant: 'Uber', merchant_normalized: 'uber', amount: 287, direction: 'debit', payment_method: 'UPI', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'transport', daysAgo: 0, hoursAgo: 5, raw_sms: 'Rs 287 paid to Uber via UPI' },
  { merchant: 'Ola Cabs', merchant_normalized: 'ola', amount: 445, direction: 'debit', payment_method: 'Wallet', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'transport', daysAgo: 2 },
  { merchant: 'IOCL Petrol', merchant_normalized: 'iocl', amount: 2500, direction: 'debit', payment_method: 'Card', account_last4: '4521', bank_name: 'ICICI', categorySlug: 'transport', daysAgo: 7 },
  { merchant: 'Uber', merchant_normalized: 'uber', amount: 198, direction: 'debit', payment_method: 'UPI', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'transport', daysAgo: 10 },
  { merchant: 'Rapido', merchant_normalized: 'rapido', amount: 89, direction: 'debit', payment_method: 'UPI', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'transport', daysAgo: 15 },
  
  // Shopping
  { merchant: 'Amazon', merchant_normalized: 'amazon', amount: 4599, direction: 'debit', payment_method: 'Card', account_last4: '4521', bank_name: 'ICICI', categorySlug: 'shopping', daysAgo: 1, raw_sms: 'Your ICICI Card X4521 used for Rs 4599 at Amazon.in' },
  { merchant: 'Flipkart', merchant_normalized: 'flipkart', amount: 1299, direction: 'debit', payment_method: 'UPI', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'shopping', daysAgo: 4 },
  { merchant: 'Myntra', merchant_normalized: 'myntra', amount: 2450, direction: 'debit', payment_method: 'Card', account_last4: '4521', bank_name: 'ICICI', categorySlug: 'shopping', daysAgo: 9 },
  { merchant: 'Amazon', merchant_normalized: 'amazon', amount: 899, direction: 'debit', payment_method: 'Card', account_last4: '4521', bank_name: 'ICICI', categorySlug: 'shopping', daysAgo: 14 },
  
  // Bills & Utilities
  { merchant: 'Airtel', merchant_normalized: 'airtel', amount: 699, direction: 'debit', payment_method: 'Auto-debit', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'bills', daysAgo: 5 },
  { merchant: 'Netflix', merchant_normalized: 'netflix', amount: 649, direction: 'debit', payment_method: 'Card', account_last4: '4521', bank_name: 'ICICI', categorySlug: 'entertainment', daysAgo: 6 },
  { merchant: 'Electricity Bill', merchant_normalized: 'electricity', amount: 2340, direction: 'debit', payment_method: 'UPI', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'bills', daysAgo: 12 },
  { merchant: 'Jio Fiber', merchant_normalized: 'jio', amount: 999, direction: 'debit', payment_method: 'Auto-debit', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'bills', daysAgo: 18 },
  
  // Entertainment
  { merchant: 'PVR Cinemas', merchant_normalized: 'pvr', amount: 780, direction: 'debit', payment_method: 'Card', account_last4: '4521', bank_name: 'ICICI', categorySlug: 'entertainment', daysAgo: 2 },
  { merchant: 'Spotify', merchant_normalized: 'spotify', amount: 119, direction: 'debit', payment_method: 'Card', account_last4: '4521', bank_name: 'ICICI', categorySlug: 'entertainment', daysAgo: 11 },
  
  // Health
  { merchant: 'Apollo Pharmacy', merchant_normalized: 'apollo', amount: 1250, direction: 'debit', payment_method: 'UPI', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'health', daysAgo: 4 },
  { merchant: 'Practo', merchant_normalized: 'practo', amount: 800, direction: 'debit', payment_method: 'UPI', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'health', daysAgo: 16 },
  
  // Income / Credits
  { merchant: 'Salary - TechCorp', merchant_normalized: 'salary', amount: 125000, direction: 'credit', payment_method: 'NEFT', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'income', daysAgo: 1, raw_sms: 'INR 1,25,000.00 credited to your A/c X8834 by NEFT - Salary TechCorp' },
  { merchant: 'Amazon Refund', merchant_normalized: 'amazon', amount: 1599, direction: 'credit', payment_method: 'IMPS', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'income', daysAgo: 7 },
  { merchant: 'Gpay Cashback', merchant_normalized: 'gpay', amount: 50, direction: 'credit', payment_method: 'UPI', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'income', daysAgo: 10 },
  
  // Transfer
  { merchant: 'Bank Transfer', merchant_normalized: 'transfer', amount: 5000, direction: 'debit', payment_method: 'IMPS', account_last4: '8834', bank_name: 'HDFC', categorySlug: 'transfer', daysAgo: 3 },
];

export async function seedSampleData(userId: string) {
  // First, get all categories
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, slug');
  
  if (catError || !categories) {
    console.error('Failed to fetch categories:', catError);
    return { success: false, error: catError };
  }

  const categoryMap = new Map(categories.map(c => [c.slug, c.id]));

  // Prepare transactions with proper dates
  const now = new Date();
  const transactions = sampleTransactions.map(txn => {
    let transactedAt = subDays(now, txn.daysAgo);
    if (txn.hoursAgo) {
      transactedAt = subHours(transactedAt, txn.hoursAgo);
    }

    return {
      user_id: userId,
      merchant: txn.merchant,
      merchant_normalized: txn.merchant_normalized,
      amount: txn.amount,
      direction: txn.direction,
      payment_method: txn.payment_method,
      account_last4: txn.account_last4,
      bank_name: txn.bank_name,
      category_id: categoryMap.get(txn.categorySlug) || null,
      raw_sms: txn.raw_sms || null,
      transacted_at: transactedAt.toISOString(),
      is_excluded: false,
    };
  });

  // Insert transactions
  const { error: insertError } = await supabase
    .from('transactions')
    .insert(transactions);

  if (insertError) {
    console.error('Failed to insert sample transactions:', insertError);
    return { success: false, error: insertError };
  }

  return { success: true };
}
