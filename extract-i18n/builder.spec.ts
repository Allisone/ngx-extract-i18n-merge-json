import { Architect, BuilderHandlerFn, BuilderOutput, createBuilder } from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { schema } from '@angular-devkit/core';
import { extractI18nMergeBuilder, Options } from './builder';
import { Translations } from './json-translations';
import { promises as fs } from 'fs';
import { jsonStringify } from './json-formatter';
import { rmSafe } from './rm-safe';

const MESSAGES_JSON_PATH = 'builder-test/messages.json';
const MESSAGES_FR_JSON_PATH = 'builder-test/messages.fr.json';

type BuilderSpy = {builder: BuilderHandlerFn<BuilderOutput>, spy: jasmine.Spy}

describe('Builder', () => {
    let architect: Architect;
    let architectHost: TestingArchitectHost;
    let extractI18nBuilderMock: BuilderSpy;
    function createBuilderSpy(name: string, successValue: boolean): BuilderSpy {
        const spy = jasmine.createSpy(name, () => null);
        return {
            builder: async () => new Promise<BuilderOutput>((resolve) => {
                setTimeout(() => {
                    spy();
                    resolve({ success: successValue });
                }, 10);
            }),
            spy,
        };
    }

    beforeEach(async () => {
        const registry = new schema.CoreSchemaRegistry();
        registry.addPostTransform(schema.transforms.addUndefinedDefaults);

        architectHost = new TestingArchitectHost(__dirname, __dirname);
        architect = new Architect(architectHost, registry);

        architectHost.addBuilder('ng-extract-i18n-merge-json:extract-i18n', createBuilder(extractI18nMergeBuilder));
        architectHost.addTarget({
            project: 'builder-test',
            target: 'extract-i18n'
        }, 'ng-extract-i18n-merge-json:extract-i18n');
        extractI18nBuilderMock = createBuilderSpy('extractI18nBuilderMock', true);
        architectHost.addBuilder('@angular-devkit/build-angular:extract-i18n', createBuilder(extractI18nBuilderMock.builder));
    });

    async function writeMessages(messages: Translations, file: string = MESSAGES_JSON_PATH, locale = 'en-US') {
        return await fs.writeFile(file, jsonStringify({
            locale,
            translations: messages,
        }), 'utf8');
    }

    async function writeFrMessages(messages: Translations) {
        return writeMessages(messages, MESSAGES_FR_JSON_PATH, 'fr-FR');
    }
    
    async function runTest(p: {
        sourceFilename?: string;
        messagesBefore?: Translations;
        messagesFrBefore?: Translations;
        options: Partial<Options>;
        messagesExpected?: Translations;
        messagesFrExpected?: Translations;
    }) {
        try {
            if (p.messagesBefore !== undefined) {
                await writeMessages(p.messagesBefore, p.sourceFilename);
            } else {
                try {
                    await rmSafe(p.sourceFilename ?? MESSAGES_JSON_PATH);
                } catch (e) {
                    // ignore error - file might have not existed
                }
            }
            if (p.messagesFrBefore !== undefined) {
                await writeFrMessages(p.messagesFrBefore);
            }

            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n'}, {
                targetFiles: {'fr-FR': 'messages.fr.json'},
                outputPath: 'builder-test',
                newPrefix: '@new',
                ...p.options
            });

            await run.result;
            const result = await run.result;
            expect(result.success).toBeTruthy();

            await run.stop();

            if (p.messagesExpected !== undefined) {
                const targetContent = await fs.readFile(p.sourceFilename ?? MESSAGES_JSON_PATH, 'utf8');
                expect(targetContent).toEqual(jsonStringify({
                    locale: 'en-US',
                    translations: p.messagesExpected,
                }))
            }
            if (p.messagesFrExpected !== undefined) {
                const targetContent = await fs.readFile(MESSAGES_FR_JSON_PATH, 'utf8');
                expect(targetContent).toEqual(jsonStringify({
                    locale: 'fr-FR',
                    translations: p.messagesFrExpected,
                }))
            }
        } finally {
            await rmSafe(p.sourceFilename ?? MESSAGES_JSON_PATH);
            await rmSafe(MESSAGES_FR_JSON_PATH);
        }
    }

    it('should fail if extract-i18n fails', async () => {
        extractI18nBuilderMock = createBuilderSpy('extractI18nBuilderMock', false);
        architectHost.addBuilder('@angular-devkit/build-angular:extract-i18n', createBuilder(extractI18nBuilderMock.builder));
        const run = await architect.scheduleTarget({ project: 'builder-test', target: 'extract-i18n' }, {
            targetFiles: { 'fr-FR': 'messages.fr.json' },
            outputPath: 'builder-test',
        });

        const result = await run.result;
        expect(result.success).toBeFalsy();
        expect(extractI18nBuilderMock.spy).toHaveBeenCalled();

        await run.stop();
    });

    it('should use custom builder for i18n extraction when configured', async () => {
        await writeMessages({'group.label': 'Label'});
        const builderFn = createBuilderSpy('customBuilder', true);
        architectHost.addBuilder('@my/custom:builder', createBuilder(builderFn.builder));
        const run = await architect.scheduleTarget({ project: 'builder-test', target: 'extract-i18n' }, {
            newPrefix: '@new',
            targetFiles: { 'fr-FR': 'messages.fr.json' },
            outputPath: 'builder-test',
            builderI18n: '@my/custom:builder'
        });
        const result = await run.result;
        expect(result.success).toBeTruthy();
        expect(builderFn.spy).toHaveBeenCalled();
        expect(extractI18nBuilderMock.spy).not.toHaveBeenCalled();

        await run.stop();
    });

    it('should succeed without a source file', async () => {
        architectHost.addBuilder('@angular-devkit/build-angular:extract-i18n', createBuilder(async () => {
            await writeMessages({'group.label': 'Label'});
            return {success: true};
        }));

        try {
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n'}, {
                newPrefix: '@new',
                targetFiles: {'fr-FR': 'messages.fr.json'},
                outputPath: 'builder-test',
            });

            const result = await run.result;
            expect(result.success).toBeTruthy();

            await run.stop();
        } finally {
            await rmSafe(MESSAGES_JSON_PATH);
            await rmSafe(MESSAGES_FR_JSON_PATH);
        }
    });

    it('should add missing translation as new', async () => {
        await runTest({
            messagesBefore: {"group.label": "Label"},
            options: {
            },
            messagesFrExpected: {"group.label": "@new Label"}
        });
    });

    it('should not touch existing translation', async () => {
        await runTest({
            messagesFrBefore: {"group.label": "Étiqueter"},
            messagesBefore: {"group.label": "Label"},
            options: {
            },
            messagesFrExpected: {"group.label": "Étiqueter"},
        });
    });

    it('should order translations by ID', async () => {
        await runTest({
            messagesFrBefore: {'banana': 'Banane'},
            messagesBefore: {'banana': 'Banana', 'apple': 'Apple'},
            options: {
            },
            messagesFrExpected: {'apple': '@new Apple', 'banana': 'Banane'},
        });
    });

    it('should remove deleted translations', async () => {
        await runTest({
            messagesFrBefore: {'apple': 'Pomme', 'banana': 'Banane'},
            messagesBefore: {'apple': 'Apple'},
            options: {
            },
            messagesFrExpected: {'apple': 'Pomme'},
        });
    });

});
