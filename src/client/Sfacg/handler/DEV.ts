import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3Client, ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import type { StreamingBlobPayloadInputTypes } from "@smithy/types";
import { Server } from "../../utils/db";

class S3 {
    endpoint: string;
    region: string;
    s3: S3Client;

    constructor(endpoint: string = "https://s3.tebi.io", region: string = "global") {
        this.endpoint = endpoint;
        this.region = region;
        this.s3 = new S3Client({
            endpoint: endpoint,
            credentials: {
                accessKeyId: process.env.ACCESSKEYID!,
                secretAccessKey: process.env.SECRETACCESSKEY!,
            },
            region: "global",
        });
    }

    async list(folder: string | number) {
        const cmd = new ListObjectsV2Command({
            Bucket: process.env.BUCKET,
            Prefix: `${folder}/`,
            MaxKeys: 1000,
        });
        let out: ListObjectsV2CommandOutput | undefined;

        do {
            const tmp = await this.s3.send(cmd);
            if (out) {
                out.Contents = out.Contents?.concat(tmp.Contents ?? []);
            } else {
                out = tmp;
            }
            cmd.input.ContinuationToken = tmp.NextContinuationToken;
        } while (cmd.input.ContinuationToken);
        out.Contents = out.Contents?.filter((i) => i.Size !== 0);
        return out;
    }

    async download(path: string, signal?: AbortSignal) {
        return this.s3.send(
            new GetObjectCommand({
                Bucket: process.env.BUCKET,
                Key: path,
            }),
            { abortSignal: signal }
        );
    }

    async upload(path: string, body: StreamingBlobPayloadInputTypes, signal?: AbortSignal) {
        return this.s3.send(
            new PutObjectCommand({
                Bucket: process.env.BUCKET,
                Key: path,
                Body: body,
                ContentType: "application/json",
            }),
            { abortSignal: signal }
        );
    }

    async listAll() {
        const cmd = new ListObjectsV2Command({
            Bucket: process.env.BUCKET,
            Delimiter: "/",
            MaxKeys: 1000,
        });
        let out: ListObjectsV2CommandOutput | undefined;
        do {
            const tmp = await this.s3.send(cmd);
            if (out) {
                out.CommonPrefixes = out.CommonPrefixes?.concat(tmp.CommonPrefixes ?? []);
            } else {
                out = tmp;
            }
            cmd.input.ContinuationToken = tmp.NextContinuationToken;
        } while (cmd.input.ContinuationToken);
        if (out.CommonPrefixes) {
            return out.CommonPrefixes.map((i) => parseInt(i.Prefix as string));
        } else {
            return [];
        }
    }
}

export async function DEV() {
    async function NullContentWithSth(chapId: number) {
        const { data, error } = await Server.from("Sfacg-chapter")
            .update({ content: null })
            .eq("chapId", chapId);
        if (error) {
            console.error("更新失败:", error);
            return null;
        }
        console.log("更新成功:", data);
        return data;
    }

    async function GetContentWithSth() {
        const { data, error } = await Server.from("Sfacg-chapter")
            .select("chapId, content")
            .not("content", "is", null)
            .limit(100);
        return data;
    }

    while (1) {
        const jjj = await GetContentWithSth();
        if (!jjj || jjj.length === 0) {
            console.log("没有数据可处理，所有数据均已迁移完成");
            break;
        }
        const load = async ({ chapId, content }: { chapId: number; content: string }) => {
            const a = new S3();
            const maxRetries = 3; // 最大重试次数
            let attempt = 0; // 当前尝试次数
            console.log(`开始上传：${chapId}`); // 增加日志
            while (attempt < maxRetries) {
                try {
                    console.log(`尝试 #${attempt + 1}：${chapId}`); // 增加日志
                    const res = await a.upload(`chap/${chapId}.txt`, content);
                    if (res.$metadata.httpStatusCode === 200) {
                        console.log(`上传成功：${chapId}`); // 增加日志
                        await NullContentWithSth(chapId);
                        console.log(`数据库数据清除成功：${chapId}`); // 增加日志
                        return res; // 成功
                    } else {
                        console.log(`上传失败，状态码非200：${chapId}`); // 增加日志
                    }
                } catch (error) {
                    console.log(`上传尝试 #${attempt + 1} 异常：${chapId}`, error); // 增加日志
                    if (attempt === maxRetries - 1) {
                        throw error;
                    }
                }
                attempt++;
                await new Promise((r) => setTimeout(r, 1000));
            }

            throw new Error(`上传失败，已达到最大重试次数：${chapId}`);
        };
        let all: any = [];
        for (let i of jjj!) {
            const p = new Promise(async (r, j) => {
                r(await load(i));
            });
            all.push(p);
        }
        await Promise.all(all);
        await new Promise((r) => setTimeout(r, 2000));
        console.log("延时");
    }
}

export { S3 };
