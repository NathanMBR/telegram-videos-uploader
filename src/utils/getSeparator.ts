type GetSeparatorMode = 'EACH SIDE' | 'TOTAL CHARS'

export const getSeparator = (
  text: string,
  targetCharsQuantity = 40,
  mode: GetSeparatorMode = 'TOTAL CHARS'
): string => {
  const lineChar = '-'
  const linesTotalLength =
    mode === 'TOTAL CHARS' ? targetCharsQuantity - text.length - 2 : targetCharsQuantity * 2

  const leftLineLength = Math.ceil(linesTotalLength / 2)
  const leftLine = new Array(leftLineLength).fill(lineChar).join('')

  const rightLineLength = Math.floor(linesTotalLength / 2)
  const rightLine = new Array(rightLineLength).fill(lineChar).join('')

  const separator = `${leftLine} ${text} ${rightLine}`
  return separator
}
