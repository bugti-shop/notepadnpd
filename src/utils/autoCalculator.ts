// Auto-calculator utility for detecting and solving math expressions in text

/**
 * Safely evaluates a mathematical expression
 * Supports: +, -, *, /, ^, parentheses
 * Works completely offline
 */
export const safeEvaluate = (expression: string): number | null => {
  try {
    // Clean the expression - remove spaces and trailing equals
    let cleaned = expression.trim().replace(/\s+/g, '').replace(/=+$/, '');
    
    // Validate: only allow numbers, operators, decimal points, and parentheses
    if (!/^[0-9+\-*/().^%]+$/.test(cleaned)) {
      return null;
    }
    
    // Replace ^ with ** for exponentiation
    cleaned = cleaned.replace(/\^/g, '**');
    
    // Replace % with /100 for percentage
    cleaned = cleaned.replace(/(\d+)%/g, '($1/100)');
    
    // Prevent dangerous patterns
    if (/[a-zA-Z_$]/.test(cleaned)) {
      return null;
    }
    
    // Use Function constructor to safely evaluate (no access to globals)
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${cleaned})`)();
    
    // Check if result is a valid number
    if (typeof result === 'number' && isFinite(result) && !isNaN(result)) {
      // Round to avoid floating point issues
      return Math.round(result * 1000000000) / 1000000000;
    }
    
    return null;
  } catch {
    return null;
  }
};

/**
 * Detects patterns like "3+4=" and returns the expression before =
 */
export const detectMathExpression = (text: string): { expression: string; position: number } | null => {
  // Match patterns like "3+4=", "10*5=", "(2+3)*4=", etc.
  // The pattern should end with = and be preceded by a valid math expression
  const regex = /([0-9+\-*/().^%\s]+)=$/;
  const match = text.match(regex);
  
  if (match && match[1]) {
    const expression = match[1].trim();
    // Ensure there's at least one operator
    if (/[+\-*/^%]/.test(expression)) {
      return {
        expression,
        position: match.index || 0
      };
    }
  }
  
  return null;
};

/**
 * Process text and auto-complete calculations
 * Input: "3+4=" -> Output: "3+4=7"
 */
export const autoCalculate = (text: string): string | null => {
  const detected = detectMathExpression(text);
  
  if (!detected) return null;
  
  const result = safeEvaluate(detected.expression);
  
  if (result !== null) {
    // Format the result nicely
    const formattedResult = Number.isInteger(result) 
      ? result.toString() 
      : result.toFixed(Math.min(10, (result.toString().split('.')[1] || '').length));
    
    return formattedResult;
  }
  
  return null;
};

/**
 * Check if cursor is right after an = sign following a math expression
 */
export const shouldAutoCalculate = (text: string, cursorPosition: number): boolean => {
  const textBeforeCursor = text.substring(0, cursorPosition);
  return detectMathExpression(textBeforeCursor) !== null;
};
