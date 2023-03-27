export type Translations = { [key: string]: string };

export interface JsonTranslations {
    locale?: string,
    translations: Translations,
}
