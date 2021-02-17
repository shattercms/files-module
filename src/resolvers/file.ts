import { Arg, Ctx, Int, Mutation, Query, Resolver } from 'type-graphql';
import { getManager, getRepository } from 'typeorm';
import { File } from '../entities/File';
import { GraphQLUpload, FileUpload } from 'graphql-upload';
import { ShatterContext } from '@shattercms/types';
import { createWriteStream, renameSync, unlinkSync } from 'fs';
import path from 'path';

@Resolver(File)
export class FileResolver {
  constructor(protected repository = getRepository(File)) {}

  @Mutation(() => File)
  async files_upload(
    @Ctx() context: ShatterContext,
    @Arg('file', () => GraphQLUpload) upload: FileUpload,
    @Arg('name', { nullable: true }) name?: string,
    @Arg('data', { nullable: true }) data?: string
  ) {
    // Add extension on rename
    let filename = upload.filename;
    if (name) {
      filename = name + getExtension(filename);
    }

    const staticDir = context.config.files?.staticDir;
    const filePath = path.join(staticDir, filename);

    // Check if that file already exists
    const f = await this.repository.findOne({ where: { filename } });
    if (f) {
      throw new Error('A file with this name already exists.');
    }

    // Start a transaction in case either of the two operations fail
    return getManager().transaction<File>(async (tem) => {
      // Create an entry in the database
      // (Write to database first as it is easier to rollback)
      let file = tem.create(File, {
        filename,
        mimetype: upload.mimetype,
        data,
      });
      file = await tem.save(file);

      // Write file to disk
      await writeUpload(upload, filePath).catch((err) => {
        console.log(err);
        throw new Error('Unable to write file to disk');
      });

      return file;
    });
  }

  @Mutation(() => Boolean)
  async files_delete(
    @Ctx() context: ShatterContext,
    @Arg('id', () => Int) id: number
  ) {
    // Get file from database
    const file = await this.repository.findOne(id);
    if (!file) {
      throw new Error('This file does not exist.');
    }

    const staticDir = context.config.files?.staticDir;
    const filePath = path.join(staticDir, file.filename);

    // Start a transaction in case either of the two operations fail
    await getManager().transaction(async (tem) => {
      const fileRepo = tem.getRepository(File);

      // Delete database entry
      // (Write to database first as it is easier to rollback)
      await fileRepo.delete(id);

      // Delete file from disk
      unlinkSync(filePath);
    });

    return true;
  }

  @Mutation(() => Boolean)
  async files_update(
    @Ctx() context: ShatterContext,
    @Arg('id', () => Int) id: number,
    @Arg('name', { nullable: true }) name?: string,
    @Arg('data', { nullable: true }) data?: string
  ) {
    // Get file from database
    const file = await this.repository.findOne(id);
    if (!file) {
      throw new Error('This file does not exist.');
    }

    // Add extension on rename
    let filename = file.filename;
    if (name) {
      filename = name + getExtension(filename);
    }

    const staticDir = context.config.files?.staticDir;
    const filePath = path.join(staticDir, filename);
    const filePathOld = path.join(staticDir, file.filename);

    // Start a transaction in case either of the two operations fail
    await getManager().transaction(async (tem) => {
      const fileRepo = tem.getRepository(File);

      // Update database entry
      // (Write to database first as it is easier to rollback)
      await fileRepo.update(id, { filename, data });

      // Rename file
      if (name) {
        renameSync(filePathOld, filePath);
      }
    });

    return true;
  }

  @Query(() => [File])
  files_getAll() {
    return this.repository.find();
  }

  @Query(() => File, { nullable: true })
  files_get(@Arg('id', () => Int) id: number) {
    return this.repository.findOne(id);
  }
}

const getExtension = (filename: string) => {
  const matches = filename.toLowerCase().match(/\.[0-9a-z]+$/);
  return matches ? matches[0] : '';
};

const writeUpload = (upload: FileUpload, filePath: string): Promise<void> =>
  new Promise(async (resolve, reject) =>
    upload
      .createReadStream()
      .pipe(createWriteStream(filePath, { autoClose: true }))
      .on('finish', resolve)
      .on('error', (err) => reject(err))
  );
