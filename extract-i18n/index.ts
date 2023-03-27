import { createBuilder } from '@angular-devkit/architect';
import { Builder } from '@angular-devkit/architect/src/internal';
import { extractI18nMergeBuilder, Options } from './builder';

const builder: Builder<Options> = createBuilder(extractI18nMergeBuilder);
export default builder;
