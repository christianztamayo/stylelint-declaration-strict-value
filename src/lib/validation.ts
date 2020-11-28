import path from 'path';

import defaults, {
  ISecondaryOptions,
  TIgnoreValue,
  TIgnoreValueList,
  IIgnoreValueHash,
  TIgnoreVariableOrFunctionConfig,
  IIgnoreVariableOrFunctionHash,
  TIgnoreValueConfig,
  TAutoFixFunc,
  TAutoFixFuncConfig,
  isIIgnoreValueHash,
} from '../defaults';

/**
 * Check if type is either `number` or `string`.
 *
 * @internal
 * @param value - Any value.
 *
 * @returns Returns `true` if `value`'s type is either `number` or `string`, else `false`.
 */
function isNumberOrString(value: unknown): value is TIgnoreValue {
  const type = typeof value;

  return type === 'string' || type === 'number';
}

/**
 * Validate primary options of stylelint plugin config.
 *
 * @internal
 * @param actual - The actual config to validate.
 *
 * @returns Returns `true` if primary options are valid, else `false`.
 */
export function validProperties(
  actual: unknown
): actual is TIgnoreValue | TIgnoreValueList {
  return (
    isNumberOrString(actual) ||
    (Array.isArray(actual) && actual.every((item) => isNumberOrString(item)))
  );
}

/**
 * Validate optional hash keyword config.
 *
 * @internal
 * @param actual - A keyword config.
 *
 * @returns Returns `true` if hash keyword config is valid, else `false`.
 */
function validHash(actual: unknown): actual is IIgnoreValueHash {
  if (typeof actual !== 'object' || !actual) return false;

  return Object.keys(actual).every((key) =>
    validProperties((actual as IIgnoreValueHash)[key as keyof IIgnoreValueHash])
  );
}

/**
 * Validate optional boolean hash variable/function config.
 *
 * @internal
 * @param actual - A variable/function config.
 *
 * @returns Returns `true` if hash variable/function config is valid, else `false`.
 */
function validBooleanHash(
  actual: unknown
): actual is IIgnoreVariableOrFunctionHash {
  if (typeof actual !== 'object' || !actual) return false;

  return Object.keys(actual).every(
    (key) =>
      typeof (actual as IIgnoreVariableOrFunctionHash)[
        key as keyof IIgnoreVariableOrFunctionHash
      ] === 'boolean'
  );
}

/**
 * Validate optional secondary options of stylelint plugin config.
 *
 * @internal
 * @param actual - The actual config to validate.
 *
 * @returns Returns `true` if secondary options are valied, else `false`.
 */
export function validOptions(actual: ISecondaryOptions): boolean {
  if (typeof actual !== 'object') return false;

  const allowedKeys = Object.keys(defaults);
  if (!Object.keys(actual).every((key) => allowedKeys.indexOf(key) > -1))
    return false;

  if (
    'ignoreVariables' in actual &&
    typeof actual.ignoreVariables !== 'boolean' &&
    !validBooleanHash(actual.ignoreVariables) &&
    actual.ignoreVariables !== null
  )
    return false;

  if (
    'ignoreFunctions' in actual &&
    typeof actual.ignoreFunctions !== 'boolean' &&
    !validBooleanHash(actual.ignoreFunctions) &&
    actual.ignoreFunctions !== null
  )
    return false;

  if (
    'severity' in actual &&
    typeof actual.severity !== 'string' &&
    actual.severity !== null
  )
    return false;

  if (
    'ignoreKeywords' in actual &&
    !validProperties(actual.ignoreKeywords) &&
    !validHash(actual.ignoreKeywords)
  )
    return false;

  if (
    'ignoreValues' in actual &&
    !validProperties(actual.ignoreValues) &&
    !validHash(actual.ignoreValues)
  )
    return false;

  if (
    'expandShorthand' in actual &&
    typeof actual.expandShorthand !== 'boolean' &&
    actual.expandShorthand !== null
  )
    return false;

  if (
    'recurseLonghand' in actual &&
    typeof actual.recurseLonghand !== 'boolean' &&
    actual.recurseLonghand !== null
  )
    return false;

  if (
    'message' in actual &&
    typeof actual.message !== 'string' &&
    actual.message !== null
  )
    return false;

  if (
    'disableFix' in actual &&
    typeof actual.disableFix !== 'boolean' &&
    actual.disableFix !== null
  )
    return false;

  if (
    'autoFixFunc' in actual &&
    typeof actual.autoFixFunc !== 'function' &&
    typeof actual.autoFixFunc !== 'string' &&
    actual.autoFixFunc !== null
  )
    return false;

  return true;
}

/**
 * @internal
 */
type TExpectedType = 'variable' | 'function' | 'keyword';
/**
 * @internal
 */
type TExpectedTypes = Array<TExpectedType>;

/**
 * Build expected message for stylelint report.
 *
 * @internal
 * @param types - Either `variable`, `function` and/or `keyword`.
 * @param value - The CSS declaration's value.
 * @param property - The CSS declaration's property.
 * @param customMessage - A custom message to be delivered upon error interpolated with `${types}`, `${value}` and `${property}`.
 *
 * @returns Returns an expected message for stylelint report.
 */
export function expected(
  types: TExpectedType | TExpectedTypes,
  value: string,
  property: string,
  customMessage = ''
): string {
  let typesMessage: string;

  if (Array.isArray(types)) {
    const typesLast = types.pop();

    // eslint-disable-next-line no-param-reassign
    typesMessage = types.length
      ? `${types.join(', ')} or ${typesLast}`
      : (typesLast as string);
  } else {
    typesMessage = types;
  }

  if (typeof customMessage === 'string' && customMessage.length) {
    /* eslint-disable no-template-curly-in-string */
    return customMessage
      .replace('${types}', typesMessage)
      .replace('${value}', value)
      .replace('${property}', property);
    /* eslint-enable no-template-curly-in-string */
  }

  return `Expected ${typesMessage} for "${value}" of "${property}"`;
}

/**
 * Get configured types for stylelint report message.
 *
 * @internal
 * @param config - The secondary stylelint-plugin config.
 * @param property - The specific CSS declaration's property of the current iteration.
 *
 * @returns Returns a list of configured types.
 */
export function getTypes(
  config: ISecondaryOptions,
  property: string
): TExpectedTypes {
  const {
    ignoreVariables,
    ignoreFunctions,
    ignoreKeywords,
    ignoreValues,
  } = config;
  const types: TExpectedTypes = [];

  if (ignoreVariables) {
    types.push('variable');
  }

  if (ignoreFunctions) {
    types.push('function');
  }

  if (ignoreKeywords && getIgnoredKeywords(ignoreKeywords, property)) {
    types.push('keyword');
  }

  if (ignoreValues && getIgnoredValues(ignoreValues, property)) {
    types.push('keyword');
  }

  return types;
}

/**
 * Get the correct ignored variable or function for a specific CSS declaration's property
 * out of a complex `ignoreVariablesOrFunctions` config hash or boolean.
 *
 * @internal
 * @param ignoreVariablesOrFunctions - The variables or functions to ignore.
 * @param property - The specific CSS declaration's property of the current iteration.
 *
 * @returns Returns ignored variable or function for a specific CSS property.
 */
export function getIgnoredVariablesOrFunctions(
  ignoreVariablesOrFunctions: TIgnoreVariableOrFunctionConfig,
  property: string
): boolean {
  // @see: https://github.com/microsoft/TypeScript/issues/41627
  // const type = typeof ignoreVariablesOrFunctions

  if (typeof ignoreVariablesOrFunctions === 'boolean') {
    return ignoreVariablesOrFunctions;
  }

  if (
    typeof ignoreVariablesOrFunctions === 'object' &&
    ignoreVariablesOrFunctions &&
    {}.hasOwnProperty.call(ignoreVariablesOrFunctions, property)
  ) {
    return ignoreVariablesOrFunctions[property];
  }

  return !!ignoreVariablesOrFunctions;
}

/**
 * Get the correct ignored keywords for a specific CSS declaration's property
 * out of a complex `ignoreKeywords` config hash or array.
 *
 * @internal
 * @param ignoreKeywords - The keyword/-s to ignore.
 * @param property - The specific CSS declaration's property of the current iteration.
 *
 * @returns Returns ignored keywords for a specific CSS property, or `null`.
 */
export function getIgnoredKeywords(
  ignoreKeywords: TIgnoreValueConfig,
  property: string
): null | TIgnoreValueList {
  if (!ignoreKeywords) return null;

  let keywords = ignoreKeywords;

  if (isIIgnoreValueHash(keywords, property)) {
    keywords = keywords[property];
  } else if (isIIgnoreValueHash(keywords, '')) {
    keywords = keywords[''];
  }

  return Array.isArray(keywords) ? keywords : [keywords];
}

/**
 * Get the correct ignored values for a specific CSS declaration's property
 * out of a complex `ignoreValues` config hash or array.
 *
 * @internal
 * @param ignoreValues - The values/-s to ignore.
 * @param property - The specific CSS declaration's property of the current iteration.
 * @returns Returns ignored values for a specific CSS property, or `null`.
 */
export function getIgnoredValues(
  ignoreValues: TIgnoreValueConfig,
  property: string
): null | TIgnoreValueList {
  if (!ignoreValues) return null;

  let values = ignoreValues;

  if (isIIgnoreValueHash(values, property)) {
    values = values[property];
  } else if (isIIgnoreValueHash(values, '')) {
    values = values[''];
  }

  return Array.isArray(values) ? values : [values];
}

/**
 * Get the auto-fix function either by a function directly or from source file.
 *
 * @internal
 * @param autoFixFunc - A JavaScript function or a module path to resolve it, also from cwd.
 *
 * @returns Returns the auto-fix function if found, else `null`.
 */
export function getAutoFixFunc(
  autoFixFunc: TAutoFixFuncConfig
): null | TAutoFixFunc {
  // @see: https://github.com/microsoft/TypeScript/issues/41627
  // const type = typeof autoFixFunc

  if (typeof autoFixFunc === 'function') {
    return autoFixFunc;
  }

  if (typeof autoFixFunc === 'string') {
    let resolveAutoFixfunc;

    try {
      resolveAutoFixfunc = require.resolve(autoFixFunc);
    } catch (error) {
      resolveAutoFixfunc = require.resolve(
        path.join(process.cwd(), autoFixFunc)
      );
    }

    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(resolveAutoFixfunc);
  }

  return null;
}
