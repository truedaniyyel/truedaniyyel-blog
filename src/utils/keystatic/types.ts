import type { Entry } from '@keystatic/core/reader';
import type keystaticConfig from '../../../keystatic.config';

export type Settings = Entry<(typeof keystaticConfig)['singletons']['settings']>;
