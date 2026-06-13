export const getMarkdownEscapedText = (text: string): string => {
  const replaceRegex = /[_*[\]()~`>#+\-=|{}.!]/g
  const replaceString = '\\$&'

  return text.replace(replaceRegex, replaceString)
}
