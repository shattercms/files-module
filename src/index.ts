import { Module } from '@shattercms/types';
import { existsSync } from 'fs';

import { File } from './entities/File';
import { FileResolver } from './resolvers/file';
export { File } from './entities/File';
export { FileResolver } from './resolvers/file';
export { graphqlUploadExpress } from 'graphql-upload';

export interface FilesConfig {
  staticDir: string;
}

const filesModule: Module = (context) => {
  context.entities.push(...[File]);
  context.resolvers.push(...[FileResolver]);

  // Check if static directory exists
  const staticDir = context.config.files?.staticDir;
  if (!existsSync(staticDir)) {
    throw new Error('The path to the static directory does not exist.');
  }
};
export default filesModule;
