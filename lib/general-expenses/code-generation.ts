function getLastNumericSegment(code: string) {
  const match = code.trim().match(/(\d+)$/);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

export function getNextGeneralExpenseTitleCode(
  groupPrefix: string,
  existingCodes: string[],
) {
  const nextNumber =
    existingCodes.reduce((max, code) => {
      const segment = getLastNumericSegment(code);
      return segment && segment > max ? segment : max;
    }, 0) + 1;

  return `${groupPrefix}.${nextNumber}`;
}

export function getNextGeneralExpenseItemCode(
  titleCode: string,
  existingCodes: string[],
) {
  const nextNumber =
    existingCodes.reduce((max, code) => {
      const segment = getLastNumericSegment(code);
      return segment && segment > max ? segment : max;
    }, 0) + 1;

  return `${titleCode}.${nextNumber}`;
}
