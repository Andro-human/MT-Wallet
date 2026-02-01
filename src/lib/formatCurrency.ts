// Format amount in Indian numbering system (₹1,00,000 format)
export function formatINR(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  // Convert to string with 2 decimal places
  const [intPart, decPart = '00'] = absAmount.toFixed(2).split('.');
  
  // Indian numbering: first 3 digits, then groups of 2
  let result = '';
  const len = intPart.length;
  
  if (len <= 3) {
    result = intPart;
  } else {
    // Last 3 digits
    result = intPart.slice(-3);
    
    // Rest of the digits in groups of 2
    let remaining = intPart.slice(0, -3);
    while (remaining.length > 2) {
      result = remaining.slice(-2) + ',' + result;
      remaining = remaining.slice(0, -2);
    }
    if (remaining) {
      result = remaining + ',' + result;
    }
  }
  
  const formatted = `₹${result}`;
  return isNegative ? `-${formatted}` : formatted;
}

// Format compact (₹1.2L, ₹50K)
export function formatINRCompact(amount: number): string {
  const absAmount = Math.abs(amount);
  
  if (absAmount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  } else if (absAmount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  } else if (absAmount >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  
  return formatINR(amount);
}
