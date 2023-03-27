import { JsonTranslations } from './json-translations';

export function jsonStringify(value: JsonTranslations): string {
    return JSON.stringify(value, null, 2);
}
