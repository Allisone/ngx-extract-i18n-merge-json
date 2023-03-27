import {Architect, createBuilder} from '@angular-devkit/architect';
import {TestingArchitectHost} from '@angular-devkit/architect/testing';
import {schema} from '@angular-devkit/core';
import {promises as fs} from 'fs';
import builder, {Options, Translations} from './builder';
import {rmSafe} from './rmSafe';
import {jsonStringify} from './jsonFormatter';
import Mock = jest.Mock;

const MESSAGES_JSON_PATH = 'builder-test/messages.json';
const MESSAGES_FR_JSON_PATH = 'builder-test/messages.fr.json';

const dummyMessages: Translations = {"group.label": "Label"};
const dummyMessagesFr: Translations = {"group.label": "Étiqueter"};
const dummyMessagesFrNew: Translations = {"group.label": "@new Label"};


describe('Builder', () => {
    let architect: Architect;
    let architectHost: TestingArchitectHost;
    let extractI18nBuilderMock: Mock;

    beforeEach(async () => {
        const registry = new schema.CoreSchemaRegistry();
        registry.addPostTransform(schema.transforms.addUndefinedDefaults);

        // TestingArchitectHost() takes workspace and current directories.
        // Since we don't use those, both are the same in this case.
        architectHost = new TestingArchitectHost(__dirname, __dirname);
        architect = new Architect(architectHost, registry);

        // This will either take a Node package name, or a path to the directory
        // for the package.json file.
        // await architectHost.addBuilderFromPackage('..');
        await architectHost.addBuilder('ng-extract-i18n-merge-json:ng-extract-i18n-merge-json', builder);
        await architectHost.addTarget({
            project: 'builder-test',
            target: 'extract-i18n-merge-json'
        }, 'ng-extract-i18n-merge-json:ng-extract-i18n-merge-json');
        extractI18nBuilderMock = jest.fn(() => ({success: true}));
        await architectHost.addBuilder('@angular-devkit/build-angular:extract-i18n', createBuilder(extractI18nBuilderMock)); // dummy builder
    });

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
                await fs.writeFile(p.sourceFilename ?? MESSAGES_JSON_PATH, jsonStringify({
                    locale: 'en-US',
                    translations: p.messagesBefore,
                }), 'utf8');
            } else {
                try {
                    await rmSafe(p.sourceFilename ?? MESSAGES_JSON_PATH);
                } catch (e) {
                    // ignore error - file might have not existed
                }
            }
            if (p.messagesFrBefore !== undefined) {
                await fs.writeFile(MESSAGES_FR_JSON_PATH, jsonStringify({
                    locale: 'fr-FR',
                    translations: p.messagesFrBefore,
                }), 'utf8');
            }

            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge-json'}, {
                targetFiles: {'fr-FR': 'messages.fr.json'},
                outputPath: 'builder-test',
                newPrefix: '@new',
                ...p.options
            });

            // The "result" member (of type BuilderOutput) is the next output.
            await run.result;
            const result = await run.result;
            expect(result.success).toBeTruthy();

            // Stop the builder from running. This stops Architect from keeping
            // the builder-associated states in memory, since builders keep waiting
            // to be scheduled.
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

    test('should fail if extract-i18n fails', async () => {
        architectHost.addBuilder('@angular-devkit/build-angular:extract-i18n', createBuilder(() => ({success: false}))); // dummy builder
        // A "run" can have multiple outputs, and contains progress information.
        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge-json'}, {
            targetFiles: {'fr-FR': 'messages.fr.json'},
            outputPath: 'builder-test',
        });

        // The "result" member (of type BuilderOutput) is the next output.
        const result = await run.result;
        expect(result.success).toBeFalsy();

        // Stop the builder from running. This stops Architect from keeping
        // the builder-associated states in memory, since builders keep waiting
        // to be scheduled.
        await run.stop();
    });

    test('should use custom builder for i18n extraction when configured', async () => {
        await fs.writeFile(MESSAGES_JSON_PATH, jsonStringify({
            locale: 'en-US',
            translations: dummyMessages,
        }), 'utf8');
        const builderFn = jest.fn(() => ({success: true}));
        architectHost.addBuilder('@my/custom:builder', createBuilder(builderFn)); // custom builder

        const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge-json'}, {
            newPrefix: '@new',
            targetFiles: {'fr-FR': 'messages.fr.json'},
            outputPath: 'builder-test',
            builderI18n: '@my/custom:builder'
        });
        const result = await run.result;

        expect(result.success).toBeTruthy();
        expect(builderFn).toHaveBeenCalled();
        expect(extractI18nBuilderMock).not.toHaveBeenCalled();

        await run.stop();
    });

    test('should succeed without a source file', async () => {
        architectHost.addBuilder('@angular-devkit/build-angular:extract-i18n', createBuilder(async () => {
            await fs.writeFile(MESSAGES_JSON_PATH, jsonStringify({
                locale: 'en-US',
                translations: dummyMessages,
            }), 'utf8');
            return {success: true};
        })); // dummy builder that only writes the source file

        await fs.writeFile(MESSAGES_FR_JSON_PATH, jsonStringify({
            locale: 'fr-FR',
            translations: dummyMessagesFr,
        }), 'utf8');

        try {
            // A "run" can have multiple outputs, and contains progress information.
            const run = await architect.scheduleTarget({project: 'builder-test', target: 'extract-i18n-merge-json'}, {
                newPrefix: '@new',
                targetFiles: {'fr-FR': 'messages.fr.json'},
                outputPath: 'builder-test',
            });

            // The "result" member (of type BuilderOutput) is the next output.
            const result = await run.result;
            expect(result.success).toBeTruthy();

            // Stop the builder from running. This stops Architect from keeping
            // the builder-associated states in memory, since builders keep waiting
            // to be scheduled.
            await run.stop();
        } finally {
            await rmSafe(MESSAGES_JSON_PATH);
            await rmSafe(MESSAGES_FR_JSON_PATH);
        }
    });

    test('should add missing translation as new', async () => {
        await runTest({
            messagesBefore: dummyMessages,
            options: {
            },
            messagesFrExpected: dummyMessagesFrNew
        });
    });

    test('should not touch existing translation', async () => {
        await runTest({
            messagesFrBefore: dummyMessagesFr,
            messagesBefore: dummyMessages,
            options: {
            },
            messagesFrExpected: dummyMessagesFr
        });
    });

    test('should order translations by ID', async () => {
        await runTest({
            messagesFrBefore: {'banana': 'Banane'},
            messagesBefore: {'banana': 'Banana', 'apple': 'Apple'},
            options: {
                sort: 'idAsc',
            },
            messagesFrExpected: {'apple': '@new Apple', 'banana': 'Banane'},
        });
    });

    test('should remove deleted translations', async () => {
        await runTest({
            messagesFrBefore: {'apple': 'Pomme', 'banana': 'Banane'},
            messagesBefore: {'apple': 'Apple'},
            options: {
            },
            messagesFrExpected: {'apple': 'Pomme'},
        });
    });
  
});
