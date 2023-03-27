import {Rule, SchematicContext, SchematicsException, Tree} from '@angular-devkit/schematics';
import {updateWorkspace} from '@schematics/angular/utility/workspace';
import {Schema} from './schema';
import {JsonArray, JsonObject, normalize, Path, relative} from '@angular-devkit/core';
import {Options} from '../../src/builder';

function getTargetFiles(i18nExtension: JsonObject | undefined): string[] {
    const locales = i18nExtension?.locales ? (Object.values(i18nExtension?.locales) as JsonArray | string[] | undefined) : undefined;
    const files = locales?.map(locale => typeof locale === 'string' ? locale : selectTargetFile((locale as JsonObject | undefined)?.translation as string[] | string | undefined));
    return files?.filter(f => f !== undefined) as string[] ?? [];
}

function selectTargetFile(translation: string[] | string | undefined): string | undefined {
    if (typeof translation === 'string') {
        return translation || undefined;
    }
    if (!translation || translation.length === 1) {
        return translation?.[0];
    }
    // simple heuristic: shortest path (translations from third parties are probably from node_modules..)
    const sorted = [...translation].sort((a, b) => a.length === b.length ? 0 : (a.length > b.length ? 1 : -1));
    return sorted[0];
}

function getOutFileRelativeToOutputPath(outFile: string, outputPathFromExtractI18nOptions: string | undefined, outputPathFromTargetFiles: string | undefined, tree: Tree, outputPath: string): Path {

    const potentialBasePathsForOutFile = [
        outputPathFromExtractI18nOptions,
        outputPathFromTargetFiles,
        'src/locales',
        '.'
    ].filter(p => !!p);
    const basePathForOutFile = potentialBasePathsForOutFile.find(p => tree.exists(normalize(`${p}/${outFile}`)));
    return basePathForOutFile ? relative(`/${outputPath}` as Path, `/${basePathForOutFile}/${outFile}` as Path) : outFile as Path;
}

// noinspection JSUnusedGlobalSymbols
export function ngAdd(_options: Schema): Rule {
    return (tree: Tree, context: SchematicContext) => {
        return updateWorkspace((workspace) => {
            const projectName = _options.project || Array.from(workspace.projects.keys())[0];
            const projectWorkspace = workspace.projects.get(projectName);
            if (!projectWorkspace) {
                throw new SchematicsException(`Project ${projectName} not found!`);
            }

            // infer target files:
            const i18nExtension: JsonObject | undefined = projectWorkspace.extensions.i18n as JsonObject | undefined;
            // alternative: search tree for *.json? --> not performant, contains node_modules
            const files = getTargetFiles(i18nExtension);
            if (!files?.length) {
                context.logger.warn('Could not infer translation target files, please setup angular i18n and re-run `ng add ng-extract-i18n-merge-json`: https://angular.io/guide/i18n-common-merge#define-locales-in-the-build-configuration');
            } else {
                context.logger.info('Found target translation files: ' + JSON.stringify(files));
            }

            // infer outputPath
            const existingI18nTargetOptions = projectWorkspace.targets.get('extract-i18n')?.options;
            const outputPathFromExtractI18nOptions = existingI18nTargetOptions?.outputPath as string | undefined;
            const outputPathFromTargetFiles: string | undefined = files?.[0]?.substring(0, files?.[0]?.lastIndexOf('/') ?? files?.[0]?.length);
            const outputPath = normalize(outputPathFromExtractI18nOptions ?? outputPathFromTargetFiles ?? 'src/locales');
            context.logger.info(`inferred output path: ${outputPath}`);

            const browserTarget = existingI18nTargetOptions?.browserTarget as string | undefined ?? `${projectName}:build`;

            // remove path from files
            const filesWithoutOutputPath = files?.map(f => relative(`/${outputPath}` as Path, `/${f}` as Path)) ?? [];

            const target = projectWorkspace.targets.get('extract-i18n');
            const builderOptions: Partial<Options> = {
                browserTarget,
                newPrefix: '@new',
                outputPath,
                targetFiles: filesWithoutOutputPath.reduce((acc, curr) => {
                    const localeMatch = curr.match(/\.([a-z]{2}(-[A-Z]{2})?)\./)
                    if (!localeMatch) {
                        console.error(`Could not determine locale from translation file ${curr}`);
                        return acc;
                    }
                    const locale: string = localeMatch[1];
                    acc[locale] = curr;
                    return acc
                }, {} as {[key: string] : string})
            };

            const outFileRelativeToOutputPath = getOutFileRelativeToOutputPath(existingI18nTargetOptions?.outFile as string | null ?? 'messages.json', outputPathFromExtractI18nOptions, outputPathFromTargetFiles, tree, outputPath);
            if (outFileRelativeToOutputPath !== 'messages.json') {
                builderOptions.sourceFile = outFileRelativeToOutputPath;
            }
            if (target) {
                context.logger.info(`Overwriting previous extract-i18n entry in project ${projectName}.`);
                target.builder = 'ng-extract-i18n-merge-json:ng-extract-i18n-merge-json';
                target.options = builderOptions;
            } else {
                projectWorkspace.targets.add({
                    name: 'extract-i18n',
                    builder: 'ng-extract-i18n-merge-json:ng-extract-i18n-merge-json',
                    options: builderOptions,
                });
            }
        });
    };
}
