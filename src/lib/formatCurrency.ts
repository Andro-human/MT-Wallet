// Format amount in Indian numbering system (₹1,00,000.50 format)
export function formatINR(amount: number, showDecimals: boolean | 'auto' = 'auto'): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  // Convert to string with 2 decimal places
  const fixedStr = absAmount.toFixed(2);
  const [intPart, decPart] = fixedStr.split('.');
  
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

  // Handle decimals based on option
  if (showDecimals === true || (showDecimals === 'auto' && decPart !== '00')) {
    result += `.${decPart}`;
  }
  
  const formatted = `₹${result}`;
  return isNegative ? `-${formatted}` : formatted;
}

// Format compact with up to 2 decimals, dropping trailing zeros (e.g., ₹4.52L, ₹8.7L)
export function formatINRCompact(amount: number, maxPrecision: number = 2): string {
  const absAmount = Math.abs(amount);
  const isNegative = amount < 0;
  const sign = isNegative ? '-' : '';
  
  const formatNum = (val: number) => parseFloat(val.toFixed(maxPrecision)).toString();

  if (absAmount >= 10000000) {
    return `${sign}₹${formatNum(absAmount / 10000000)}Cr`;
  } else if (absAmount >= 100000) {
    return `${sign}₹${formatNum(absAmount / 100000)}L`;
  } else if (absAmount >= 1000) {
    return `${sign}₹${formatNum(absAmount / 1000)}K`;
  }
  
  return formatINR(amount);
}
