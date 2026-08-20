function numberToWordsUSD(amount) {
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

  function threeDigits(n) {
    let s = '';
    if (n >= 100) {
      s += ones[Math.floor(n / 100)] + ' HUNDRED ';
      n %= 100;
    }
    if (n >= 20) {
      s += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
      if (n) s += ones[n] + ' ';
    } else if (n > 0) {
      s += ones[n] + ' ';
    }
    return s;
  }

  function intToWords(num) {
    if (num === 0) return 'ZERO';
    let s = '';
    const crore = Math.floor(num / 10000000); num %= 10000000;
    const lakh = Math.floor(num / 100000); num %= 100000;
    const thousand = Math.floor(num / 1000); num %= 1000;
    const rest = num;
    if (crore) s += threeDigits(crore) + 'CRORE ';
    if (lakh) s += threeDigits(lakh) + 'LAKH ';
    if (thousand) s += threeDigits(thousand) + 'THOUSAND ';
    if (rest) s += threeDigits(rest);
    return s.trim();
  }

  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  let words = 'USD ' + intToWords(whole) + ' ONLY';
  if (cents > 0) {
    words = 'USD ' + intToWords(whole) + ' AND CENTS ' + intToWords(cents) + ' ONLY';
  }
  return words;
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

module.exports = { numberToWordsUSD, fmtMoney, fmtNum };
