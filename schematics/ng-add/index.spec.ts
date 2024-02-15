import {SchematicTestRunner, UnitTestTree} from '@angular-devkit/schematics/testing';
import * as path from 'path';

import {Schema as WorkspaceOptions} from '@schematics/angular/workspace/schema';
import {Schema as ApplicationOptions, Style} from '@schematics/angular/application/schema';
import {Tree} from "@angular-devkit/schematics";

const collectionPath = path.join(__dirname, '../collection.json');

const workspaceOptions: WorkspaceOptions = {
    name: 'workspace',
    newProjectRoot: 'projects',
    version: '6.0.0',
};

const appOptions: ApplicationOptions = {
    name: 'bar',
    inlineStyle: false,
    inlineTemplate: false,
    routing: false,
    style: Style.Css,
    skipTests: false,
    skipPackageJson: false,
};

function norm(s: string) {
    return s.replace(/\s+/g, '');
}

describe('ngAdd', () => {
    const runner = new SchematicTestRunner('schematics', collectionPath);

    let appTree: UnitTestTree;

    beforeEach(async () => {
        appTree = await runExternalSchematic(runner, '@schematics/angular', 'workspace', workspaceOptions);
        appTree = await runExternalSchematic(runner, '@schematics/angular', 'application', appOptions, appTree);
    });

    it('works', async () => {
        const tree = await runSchematic(runner, 'ng-add', {}, appTree);
        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n": {\n' +
            '          "builder": "ngx-extract-i18n-merge-json:extract-i18n",\n' +
            '          "options": {\n' +
            '            "browserTarget": "bar:build",\n' +
            '            "newPrefix": "@new",\n' +
            '            "outputPath": "src/locales",\n' +
            '            "targetFiles": {}\n' +
            '          }\n' +
            '        }'));
    });

    it('should infer json', async () => {
        appTree.create('/src/other-path/messages.fr.json', '{"locale": "fr-FR", "translations": {"group.id.label": "label"}}');
        const angularJson = JSON.parse(appTree.readContent('/angular.json'));
        angularJson.projects.bar.i18n = {
            locales: {
                'fr': 'src/other-path/messages.fr.json'
            }
        };
        appTree.overwrite('/angular.json', JSON.stringify(angularJson));

        const tree = await runSchematic(runner, 'ng-add', {}, appTree);

        expect(norm(tree.readContent('/angular.json'))).toContain(norm('"extract-i18n": {\n' +
            '          "builder": "ngx-extract-i18n-merge-json:extract-i18n",\n' +
            '          "options": {\n' +
            '            "browserTarget": "bar:build",\n' +
            '            "newPrefix": "@new",\n' +
            '            "outputPath": "src/other-path",\n' +
            '            "targetFiles": {"fr": "messages.fr.json"}\n' +
            '          }\n' +
            '        }'));
    });
})
;

// Add legacy support for versions before v16
interface LegacySchematicTestRunner extends SchematicTestRunner {
    /**
     * Legacy support.
     * @deprecated
     */
    runSchematicAsync<SchematicSchemaT extends object>(
        schematicName: string,
        opts?: SchematicSchemaT,
        tree?: Tree,
    ): { toPromise(): Promise<UnitTestTree> };
    /**
     * Legacy support.
     * @deprecated
     */
    runExternalSchematicAsync<SchematicSchemaT extends object>(
        collectionName: string,
        schematicName: string,
        opts?: SchematicSchemaT,
        tree?: Tree,
    ): { toPromise(): Promise<UnitTestTree> };
}

function runSchematic<SchematicSchemaT extends object>(runner: SchematicTestRunner, schematicName: string, opts?: SchematicSchemaT, tree?: Tree): Promise<UnitTestTree> {
    // current version (>=v16)
    if ('runSchematic' in runner) {
        return runner.runSchematic(schematicName, opts, tree);
    // legacy version (<v16)
    } else if ('runSchematicAsync' in runner) {
        return (runner as LegacySchematicTestRunner).runSchematicAsync(schematicName, opts, tree).toPromise();
    } else {
        throw new Error('Unsupported version of SchematicTestRunner');
    }
}

function runExternalSchematic<SchematicSchemaT extends object>(runner: SchematicTestRunner, collectionName: string, schematicName: string, opts?: SchematicSchemaT, tree?: Tree): Promise<UnitTestTree> {
    // current version (>=v16)
    if ('runExternalSchematic' in runner) {
        return runner.runExternalSchematic(collectionName, schematicName, opts, tree);
    // legacy version (<v16)
    } else if ('runExternalSchematicAsync' in runner) {
        return (runner as LegacySchematicTestRunner).runExternalSchematicAsync(collectionName, schematicName, opts, tree).toPromise();
    } else {
        throw new Error('Unsupported version of SchematicTestRunner');
    }
}
