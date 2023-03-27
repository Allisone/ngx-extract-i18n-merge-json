import { JsonTranslations } from './builder';

export function jsonStringify(value: JsonTranslations): string {
    return JSON.stringify(value, ['locale', 'translations', ...Object.keys(value.translations).sort()], 2);
}
