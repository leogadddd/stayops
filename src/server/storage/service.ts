import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

export class StorageError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "StorageError";
  }
}

export interface StoredObject {
  key: string;
  contentType?: string;
  contentLength?: number;
  eTag?: string;
  lastModified?: Date;
}

export interface StoredObjectContent extends StoredObject {
  body: Uint8Array;
}

export interface ObjectList {
  objects: StoredObject[];
  nextContinuationToken?: string;
}

export interface ObjectStorage {
  put(input: {
    key: string;
    body: Uint8Array;
    contentType?: string;
  }): Promise<StoredObject>;
  get(key: string): Promise<StoredObjectContent>;
  head(key: string): Promise<StoredObject>;
  list(input?: {
    prefix?: string;
    continuationToken?: string;
    maxKeys?: number;
  }): Promise<ObjectList>;
  delete(key: string): Promise<void>;
}

interface S3Sender {
  send(command: unknown): Promise<unknown>;
}

export interface S3ObjectStorageOptions {
  bucket: string;
  client: S3Sender;
}

/**
 * S3-compatible object CRUD. Neon Object Storage is configured with the
 * standard AWS endpoint and credential environment variables.
 */
export class S3ObjectStorage implements ObjectStorage {
  private readonly bucket: string;
  private readonly client: S3Sender;

  constructor({ bucket, client }: S3ObjectStorageOptions) {
    if (!bucket.trim()) throw new StorageError("S3_BUCKET must be configured.");
    this.bucket = bucket;
    this.client = client;
  }

  async put({ key, body, contentType }: Parameters<ObjectStorage["put"]>[0]) {
    const objectKey = validateKey(key);
    try {
      const result = await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
      })) as { ETag?: string };
      return { key: objectKey, contentType, contentLength: body.byteLength, eTag: result.ETag };
    } catch (error) {
      throw storageFailure("upload", objectKey, error);
    }
  }

  async get(key: string): Promise<StoredObjectContent> {
    const objectKey = validateKey(key);
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey })) as {
        Body?: { transformToByteArray?: () => Promise<Uint8Array> };
        ContentType?: string;
        ContentLength?: number;
        ETag?: string;
        LastModified?: Date;
      };
      if (!result.Body?.transformToByteArray) throw new StorageError("Storage response did not include object content.");
      return {
        key: objectKey,
        body: await result.Body.transformToByteArray(),
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        eTag: result.ETag,
        lastModified: result.LastModified,
      };
    } catch (error) {
      throw error instanceof StorageError ? error : storageFailure("read", objectKey, error);
    }
  }

  async head(key: string): Promise<StoredObject> {
    const objectKey = validateKey(key);
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey })) as {
        ContentType?: string;
        ContentLength?: number;
        ETag?: string;
        LastModified?: Date;
      };
      return {
        key: objectKey,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        eTag: result.ETag,
        lastModified: result.LastModified,
      };
    } catch (error) {
      throw storageFailure("read metadata for", objectKey, error);
    }
  }

  async list(input: Parameters<ObjectStorage["list"]>[0] = {}): Promise<ObjectList> {
    if (input.prefix !== undefined) validatePrefix(input.prefix);
    if (input.maxKeys !== undefined && (!Number.isInteger(input.maxKeys) || input.maxKeys < 1 || input.maxKeys > 1_000)) {
      throw new StorageError("maxKeys must be an integer between 1 and 1000.");
    }
    try {
      const result = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: input.prefix,
        ContinuationToken: input.continuationToken,
        MaxKeys: input.maxKeys,
      })) as {
        Contents?: Array<{ Key?: string; Size?: number; ETag?: string; LastModified?: Date }>;
        NextContinuationToken?: string;
      };
      return {
        objects: (result.Contents ?? []).flatMap((object) => object.Key ? [{
          key: object.Key,
          contentLength: object.Size,
          eTag: object.ETag,
          lastModified: object.LastModified,
        }] : []),
        nextContinuationToken: result.NextContinuationToken,
      };
    } catch (error) {
      throw new StorageError("Could not list storage objects.", error);
    }
  }

  async delete(key: string): Promise<void> {
    const objectKey = validateKey(key);
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    } catch (error) {
      throw storageFailure("delete", objectKey, error);
    }
  }
}

function validateKey(key: string): string {
  if (!key || key.startsWith("/") || key.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new StorageError("Object keys must be non-empty relative paths without '.' or '..' segments.");
  }
  return key;
}

function validatePrefix(prefix: string) {
  if (prefix.startsWith("/") || prefix.split("/").some((part) => part === "." || part === "..")) {
    throw new StorageError("Object prefixes must be relative paths without '.' or '..' segments.");
  }
}

function storageFailure(operation: string, key: string, cause: unknown) {
  return new StorageError(`Could not ${operation} storage object '${key}'.`, cause);
}

/** Creates the application storage service from Neon S3 environment variables. */
export function createObjectStorageFromEnvironment(
  env: Record<string, string | undefined> = process.env,
): ObjectStorage {
  const endpoint = env.AWS_ENDPOINT_URL_S3?.trim();
  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();
  const region = env.AWS_REGION?.trim();
  const bucket = env.S3_BUCKET?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey || !region || !bucket) {
    throw new StorageError("AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and S3_BUCKET must be configured.");
  }
  const config: S3ClientConfig = {
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
  };
  return new S3ObjectStorage({ bucket, client: new S3Client(config) });
}
