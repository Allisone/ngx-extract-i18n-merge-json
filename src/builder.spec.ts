import {Architect, createBuilder} from '@angular-devkit/architect';
import {TestingArchitectHost} from '@angular-devkit/architect/testing';
import {schema} from '@angular-devkit/core';
import {promises as fs} from 'fs';
import builder, {Options} from './builder';
import {rmSafe} from './rmSafe';
import {jsonStringify} from './jsonFormatter';
import Mock = jest.Mock;

const MESSAGES_JSON_PATH = 'builder-test/messages.json';
const MESSAGES_FR_JSON_PATH = 'builder-test/messages.fr.json';

const dummyContent = {locale: "en-US", translations: {"group.id.label": "Label"}};
const dummyContentFr = {locale: "fr-FR", translations: {"group.id.label": "Étiqueter"}};
const dummyContentFrNew = {locale: "fr-FR", translations: {"group.id.label": "@new Label"}};

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
        messagesBefore?: string;
        messagesFrBefore?: string;
        options: Partial<Options>;
        messagesExpected?: string;
        messagesFrExpected?: string;
    }) {
        try {
            if (p.messagesBefore !== undefined) {
                await fs.writeFile(p.sourceFilename ?? MESSAGES_JSON_PATH, p.messagesBefore, 'utf8');
            } else {
                try {
                    await rmSafe(p.sourceFilename ?? MESSAGES_JSON_PATH);
                } catch (e) {
                    // ignore error - file might have not existed
                }
            }
            if (p.messagesFrBefore !== undefined) {
                await fs.writeFile(MESSAGES_FR_JSON_PATH, p.messagesFrBefore, 'utf8');
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
                expect(targetContent).toEqual(p.messagesExpected)
            }
            if (p.messagesFrExpected !== undefined) {
                const targetContent = await fs.readFile(MESSAGES_FR_JSON_PATH, 'utf8');
                expect(targetContent).toEqual(p.messagesFrExpected)
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
        await fs.writeFile(MESSAGES_JSON_PATH, jsonStringify(dummyContent), 'utf8');
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
            await fs.writeFile(MESSAGES_JSON_PATH, jsonStringify(dummyContent), 'utf8');
            return {success: true};
        })); // dummy builder that only writes the source file

        await fs.writeFile(MESSAGES_FR_JSON_PATH, jsonStringify(dummyContentFr), 'utf8');

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
            messagesFrBefore: '',
            messagesBefore: jsonStringify(dummyContent),
            options: {
            },
            messagesFrExpected: jsonStringify(dummyContentFrNew)
        });
    });

    test('should not touch existing translation', async () => {
        await runTest({
            messagesFrBefore: jsonStringify(dummyContentFr),
            messagesBefore: jsonStringify(dummyContent),
            options: {
            },
            messagesFrExpected: jsonStringify(dummyContentFr)
        });
    });
  
});
