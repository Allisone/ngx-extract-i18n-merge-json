import { JsonTranslations } from './builder';

export function jsonStringify(value: JsonTranslations): string {
    return JSON.stringify(value, null, 2);
}
