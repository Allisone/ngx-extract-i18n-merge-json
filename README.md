# Angular JSON extract i18n and merge

Based on [`ng-extract-i18n-merge`](https://github.com/daniel-sc/ng-extract-i18n-merge) by @daniel-sc.

This extends Angular CLI to improve the i18n extraction and merge workflow. New/removed translations are added/removed
from the target translation files. Additionally, translation files are normalized (pretty print, sorted by id) so that
diffs are easy to read (and translations in PRs might actually get reviewed ;-) ).

## Install

_Prerequisites_: i18n setup with defined target locales in `angular.json` - as
documented [here](https://angular.io/guide/i18n-common-merge).

```shell
ng add ng-extract-i18n-merge-json
```

## Usage

```shell
ng extract-i18n # this replaces and extends the original builder
```

### Configuration

In your `angular.json` the target `extract-i18n` that can be configured with the following options:

| Name                         | Default                                                     | Description                                                                                                                                                                                                                                                                                                                |
|------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `browserTarget`              | Inferred from current setup by `ng add`                     | A browser builder target to extract i18n messages in the format of `project:target[:configuration]`. See https://angular.io/cli/extract-i18n#options                                                                                                                                                                       |
| `outputPath`                 | Inferred from current setup by `ng add`                     | Path to folder containing all (source and target) translation files.                                                                                                                                                                                                                                                       |
| `targetFiles`                | Inferred from current setup by `ng add`                     | Filenames (relative to `outputPath` of all target translation files (e.g. `{"fr-FR": "messages.fr.json", "de-DE": "messages.de.json"`).                                                                                                                                                                                                       |
| `sourceLocale`   | Undefined                                                      | If this is set (to one of the `targetFiles` locales), new translations in that target file won't include the `newPrefix` prefix).                                                                                                                                                                      |
| `sourceFile`                 | `messages.json`. `ng add` tries to infer non default setups. | Filename (relative to `outputPath` of source translation file (e.g. `"translations-source.json"`).                                                                                                                                                                                                                          |
| `newPrefix`                 | This prefix will be added to all new translations (e.g. `@new`).                                                                                                                                                                                                                          |
| `removeIdsWithPrefix`        | `[]`                                                        | List of prefix strings. All translation units with matching `id` attribute are removed. Useful for excluding duplicate library translations.                                                                                                                                                                               |
| `collapseWhitespace`         | `true`                                                      | Collapsing of multiple whitespaces/line breaks in translation sources and targets.                                                                                                                                                                                                                                         |
| `trim`                       | `false`                                                     | Trim translation sources and targets.                                                                                                                                                                                                                                                                                      |
| `includeContext`             | `false`                                                     | Whether to include the context information (like notes) in the translation files. This is useful for sending the target translation files to translation agencies/services. When `sourceFileOnly` the context is retained only in the `sourceFile`.                                                                        |
| `newTranslationTargetsBlank` | `false`                                                     | When `false` (default) the "target" of new translation units is set to the "source" value. When `true`, an empty string is used. When `'omit'`, no target element is created.                                                                                                                                              |
| `sort`                       | `"stableAppendNew"`                                         | Sorting of all translation units in source and target translation files. Supported: <br>`"idAsc"` (sort by translation IDs), <br>`"stableAppendNew"` (keep existing sorting, append new translations at the end), <br>`"stableAlphabetNew"` (keep existing sorting, sort new translations next to alphabetical close IDs)  |
| `builderI18n`                | `"@angular-devkit/build-angular:extract-i18n"`              | The builder to use for i18n extraction. Any custom builder should handle the same options as the default angular builder (browserTarget, outputPath, outFile, format, progress).                                                                                                                                           |
| `verbose`                    | `false`                                                     | Extended/debug output - it is recommended to use this only for manual debugging.                                                                                                                                                                                                                                           |

## Contribute

Feedback and PRs always welcome :-)

Before developing complex changes, I'd recommend opening an issue to discuss whether the indented goals match the scope of this package.
