import stylelint from 'stylelint'

const ruleName = 'scale-unlimited/declaration-strict-value'
const utils = stylelint.utils
const messages = utils.ruleMessages(ruleName, {
  expected: (type, value, property) => {
    if (Array.isArray(type)) {
      const typeLast = type.pop()

      type = type.length ? `${type.join(', ')} or ${typeLast}` : typeLast
    }

    return `Expected ${type} for ${value} of ${property}`
  },
})
const reVar = /^(?:@.+|\$.+|var\(--.+\))$/
const reFunc = /^.+\(.+\)$/
const defaults = {
  ignoreFunctions: true,
  ignoreKeywords: null,
}

const getIgnoredKeywords = (ignoreKeywords, property) => {
  if (!ignoreKeywords) return null

  return ignoreKeywords[property] || ignoreKeywords[''] || ignoreKeywords
}

const rule = (properties, options) =>
  (root, result) => {
    const hasValidOptions = utils.validateOptions(
      result,
      ruleName,
      {
        actual: properties,
        possible: validProperties,
      },
      {
        actual: options,
        possible: validOptions,
        optional: true,
      }
    )

    if (!hasValidOptions) return

    if (!Array.isArray(properties)) {
      properties = [properties]
    }

    const { ignoreKeywords, ignoreFunctions } = {
      ...defaults,
      ...options,
    }
    const reKeywords = ignoreKeywords ? {} : null

    properties.forEach((property) => {
      let propFilter = property

      if (propFilter.charAt(0) === '/' && propFilter.slice(-1) === '/') {
        propFilter = new RegExp(propFilter.slice(1, -1))
      }

      root.walkDecls(propFilter, declsWalker)

      function declsWalker(node) {
        const { value, prop } = node
        const validVar = reVar.test(value)
        let validFunc = false
        let validKeyword = false

        if (ignoreFunctions && !validVar) {
          validFunc = reFunc.test(value)
        }

        if (ignoreKeywords && (!validVar || !validFunc)) {
          let reKeyword = reKeywords[property]

          if (!reKeyword) {
            const ignoreKeyword = getIgnoredKeywords(ignoreKeywords, property)

            if (ignoreKeyword) {
              reKeyword = new RegExp(`^${ignoreKeyword.join('|')}$`)
              reKeywords[property] = reKeyword
            }
          }

          if (reKeyword) {
            validKeyword = reKeyword.test(value)
          }
        }

        if (!validVar && !validFunc && !validKeyword) {
          const type = ['variable']

          if (ignoreFunctions) {
            type.push('function')
          }

          if (ignoreKeywords && getIgnoredKeywords(ignoreKeywords, property)) {
            type.push('keyword')
          }

          const { raws } = node
          const { start } = node.source

          utils.report({
            ruleName,
            result,
            node,
            line: start.line,
            column: start.column + prop.length + raws.between.length,
            message: messages.expected(type, value, prop),
          })
        }
      }
    })
  }

rule.primaryOptionArray = true

const declarationStrictValuePlugin = stylelint.createPlugin(ruleName, rule)

export default declarationStrictValuePlugin
export { ruleName, messages }

function validProperties(actual) {
  return typeof actual === 'string' ||
    (Array.isArray(actual) && actual.every(item => typeof item === 'string'))
}

function validOptions(actual) {
  if (typeof actual !== 'object') return false

  const allowedKeys = Object.keys(defaults)
  if (!Object.keys(actual).every(key => allowedKeys.indexOf(key) > -1)) return false

  if ('ignoreFunctions' in actual &&
    (typeof actual.ignoreFunctions === 'boolean' || actual.ignoreFunctions !== null)) return false

  if ('ignoreKeywords' in actual && !validProperties(actual.ignoreKeywords)) return false

  return true
}
