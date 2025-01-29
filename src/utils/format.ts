/**
 * Returns a string of form "abc...xyz"
 * @param {string} str string to string
 * @param {number} n number of chars to keep at front/end
 * @returns {string}
 */
export const getEllipsisTxt = (str?: string, n = 3) => {
  if (str) {
    return `${str.slice(0, n+2)}...${str.slice(str.length - n)}`;
  }
  return '';
};
