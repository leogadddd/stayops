import { describe, expect, it, vi } from "vitest";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { S3ObjectStorage, StorageError, createObjectStorageFromEnvironment } from "@/server/storage/service";

function storage(result: unknown = {}) {
  const send = vi.fn().mockResolvedValue(result);
  return { send, service: new S3ObjectStorage({ bucket: "stayops-dev", client: { send } }) };
}

describe("S3ObjectStorage", () => {
  it("uploads an object to its configured bucket", async () => {
    const { service, send } = storage({ ETag: '"etag"' });
    await expect(service.put({ key: "orgs/o1/proof.png", body: new Uint8Array([1, 2]), contentType: "image/png" }))
      .resolves.toEqual({ key: "orgs/o1/proof.png", contentType: "image/png", contentLength: 2, eTag: '"etag"' });
    const command = send.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({ Bucket: "stayops-dev", Key: "orgs/o1/proof.png", ContentType: "image/png" });
  });

  it("reads object bytes and metadata", async () => {
    const modified = new Date("2026-09-25T00:00:00.000Z");
    const { service, send } = storage({ Body: { transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array([4])) }, ContentType: "image/webp", ContentLength: 1, ETag: "etag", LastModified: modified });
    await expect(service.get("orgs/o1/photo.webp")).resolves.toMatchObject({ key: "orgs/o1/photo.webp", body: new Uint8Array([4]), lastModified: modified });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand);
  });

  it("lists, reads metadata, and deletes objects", async () => {
    const { service, send } = storage({ Contents: [{ Key: "orgs/o1/a.png", Size: 20, ETag: "etag" }], NextContinuationToken: "next" });
    await expect(service.list({ prefix: "orgs/o1/", maxKeys: 10 })).resolves.toEqual({ objects: [{ key: "orgs/o1/a.png", contentLength: 20, eTag: "etag", lastModified: undefined }], nextContinuationToken: "next" });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(ListObjectsV2Command);

    send.mockResolvedValueOnce({ ContentType: "image/png", ContentLength: 20 });
    await expect(service.head("orgs/o1/a.png")).resolves.toEqual({ key: "orgs/o1/a.png", contentType: "image/png", contentLength: 20, eTag: undefined, lastModified: undefined });
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(HeadObjectCommand);

    await service.delete("orgs/o1/a.png");
    expect(send.mock.calls[2]?.[0]).toBeInstanceOf(DeleteObjectCommand);
  });

  it("rejects unsafe keys and invalid list bounds before sending", async () => {
    const { service, send } = storage();
    await expect(service.get("../private")).rejects.toThrow(StorageError);
    await expect(service.list({ maxKeys: 1_001 })).rejects.toThrow("between 1 and 1000");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("createObjectStorageFromEnvironment", () => {
  it("requires every Neon S3 setting", () => {
    expect(() => createObjectStorageFromEnvironment({ S3_BUCKET: "uploads" })).toThrow("AWS_ENDPOINT_URL_S3");
  });
});
