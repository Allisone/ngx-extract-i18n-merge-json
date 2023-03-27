import { BuilderContext, BuilderOutput } from '@angular-devkit/architect';
import { basename, dirname, join, JsonObject, normalize } from '@angular-devkit/core';
import { promises as fs } from 'fs';
import { readFileIfExists } from './file-utils';
import { jsonStringify } from './json-formatter';
import { Translations, JsonTranslations } from './json-translations';

export interface Options extends JsonObject {
    outputPath: string | null,
    sourceFile: string | null,
    targetFiles: { [locale: string]: string },
    sourceLanguageTargetLocale: string | null,
    removeIdsWithPrefix: string[] | null,
    newPrefix: string,
    collapseWhitespace: boolean,
    trim: boolean,
    browserTarget: string,
    builderI18n: string,
    verbose: boolean
}

function mergeTranslations(source: JsonTranslations, target: JsonTranslations, locale: string, options: Options) {
    const targetTranslations: Translations = {};
    target.locale = locale;
    if (!target.translations) {
        target.translations = {};
    }
    for (const id of Object.keys(source.translations).sort()) {
        if (id in target.translations) {
            targetTranslations[id] = target.translations[id];
        } else {
            targetTranslations[id] = options.sourceLanguageTargetLocale === locale
                ? source.translations[id]
                : `${options.newPrefix} ${source.translations[id]}`
        }
    }
    target.translations = targetTranslations;
}
export async function extractI18nMergeBuilder(options: Options, context: BuilderContext): Promise<BuilderOutput> {
    context.logger.info(`Running ngx-extract-i18n-merge-json for project ${context.target?.project}`);

    context.logger.debug(`options: ${JSON.stringify(options)}`);
    const outputPath = options.outputPath as string || '.';

    context.logger.info('running "extract-i18n" ...');
    const sourcePath = join(normalize(outputPath), options.sourceFile ?? 'messages.json');

    const extractI18nRun = await context.scheduleBuilder(options.builderI18n ?? '@angular-devkit/build-angular:extract-i18n', {
        browserTarget: options.browserTarget,
        outputPath: dirname(sourcePath),
        outFile: basename(sourcePath),
        format: 'json',
        progress: false
    }, { target: context.target, logger: context.logger.createChild('extract-i18n') });
    const extractI18nResult = await extractI18nRun.result;

    if (!extractI18nResult.success) {
        return { success: false, error: `"extract-i18n" failed: ${extractI18nResult.error}` };
    }
    context.logger.info(`extracted translations successfully`);

    context.logger.info(`normalize ${sourcePath} ...`);
    const translationSourceFile = await fs.readFile(sourcePath, 'utf8');
    const sourceTranslations: JsonTranslations = JSON.parse(translationSourceFile);

    for (const targetLocale of Object.keys(options.targetFiles)) {
        const targetFile = options.targetFiles[targetLocale];
        const targetPath = join(normalize(outputPath), targetFile);
        context.logger.info(`merge and normalize ${targetPath} ...`);
        const translationTargetFile = await readFileIfExists(targetPath) ?? '{}';
        const targetTranslations: JsonTranslations = translationTargetFile
            ? JSON.parse(translationTargetFile)
            : { locale: targetLocale, translations: {} }

        mergeTranslations(sourceTranslations, targetTranslations, targetLocale, options)
        await fs.writeFile(targetPath, jsonStringify(targetTranslations));
    }

    await fs.writeFile(sourcePath, jsonStringify(sourceTranslations));

    context.logger.info('finished i18n merging and normalizing');
    return { success: true };
}
