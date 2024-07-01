import { IaccountInfo, _dbChapters, _dbNovels } from "../types/ITypes";
import { Server } from "../../utils/db";
import { colorize } from "../../utils/tools";
import { SfacgClient } from "../api/client";
import { novelInfo } from "../types/Types";
import { S3 } from "./DEV";

export class _SfacgCache {
    static async UpsertNovelInfo(novel: novelInfo) {
        await Server.from("Sfacg-novelInfos").upsert({
            novelId: novel.novelId,
            novelName: novel.novelName,
            authorName: novel.authorName,
        });
    }

    static async UpsertChapterInfo(chapters: _dbChapters) {
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
        const { data, error } = await Server.from("Sfacg-chapter").upsert({
            chapId: chapters.chapId,
            volumeId: chapters.volumeId,
            novelId: chapters.novelId,
            ntitle: chapters.ntitle,
        });
        const load = async (chapId: number, content: string) => {
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
                attempt++; // 增加尝试次数
                await new Promise((r) => setTimeout(r, 1000)); // 等待1秒再重试
            }

            throw new Error(`上传失败，已达到最大重试次数：${chapId}`); // 增加日志
        };
        await load(chapters.chapId, chapters.content);
        if (error) {
            console.log(
                `Error UpsertChapterInfo: ${colorize(`${chapters.chapId}`, "purple")} `,
                error
            );
            return null;
        }
        console.log(`UpsertChapterInfo successfully ${colorize(`${chapters.chapId}`, "green")}`);
        return true;
    }

    private static async UpsertAccount(accountInfo: IaccountInfo) {
        const { data, error } = await Server.from("Sfacg-Accounts").upsert({
            userName: accountInfo.userName,
            passWord: accountInfo.passWord,
            accountId: accountInfo.accountId,
            nickName: accountInfo.nickName,
            avatar: accountInfo.avatar,
            vipLevel: accountInfo.vipLevel,
            fireMoneyRemain: accountInfo.fireMoneyRemain,
            couponsRemain: accountInfo.couponsRemain,
            cookie: accountInfo.cookie,
        });
        if (error) {
            console.log(
                `Error UpsertAccount: ${colorize(`${accountInfo.userName}`, "purple")} `,
                error
            );
            return null;
        }
        console.log(`UpsertAccount successfully ${colorize(`${accountInfo.userName}`, "green")}`);
    }
    // 更新用户账号信息
    static async UpdateAccount(acconutInfo: IaccountInfo, newAccount: boolean = false) {
        const { userName, passWord } = acconutInfo;
        const { result, anonClient } = await SfacgClient.initClient(acconutInfo, "userInfo");
        if (newAccount) {
            const Fav = await anonClient.NewAccountFavBonus();
            Fav && console.log("新号收藏任务完成");
            const Follow = await anonClient.NewAccountFollowBonus();
            Follow && console.log("新号关注任务完成");
        }
        const money = await anonClient.userMoney();
        const accountInfo = {
            userName: userName,
            passWord: passWord,
            cookie: anonClient.GetCookie(),
            ...result,
            ...money,
        };
        result && money
            ? this.UpsertAccount(accountInfo as IaccountInfo)
            : console.log("账号信息获取失败，请检查账号密码");
    }

    static async RemoveAccount(userName: string) {
        const { data, error } = await Server.from("Sfacg-Accounts")
            .delete()
            .eq("userName", userName);

        if (error) {
            console.log(`Error removeAccount: ${colorize(`${userName}`, "purple")} `, error);
            return null;
        }
        console.log(`removeAccount successfully ${colorize(`${userName}`, "green")}`);
    }

    // 返回一个包含账号密码cookie对象的列表
    static async GetallCookies() {
        const { data, error } = await Server.from("Sfacg-Accounts").select(
            "userName, passWord, cookie,accountId"
        );

        if (error) {
            console.error("Error fetching cookie:", error);
            return null;
        }
        return data;
    }

    static async GetAccountMoney() {
        const { data, error } = await Server.from("Sfacg-Accounts")
            .select("userName, passWord, cookie,couponsRemain")
            .order("couponsRemain");
        if (error) {
            console.error("Error fetching cookie:", error);
            return null;
        }
        return data;
    }

    static async GetAccountList() {
        const { data, error } = await Server.from("Sfacg-Accounts").select("*");

        if (error) {
            console.error("Error getAccountList:", error);
            return null;
        }
        return data as IaccountInfo[];
    }

    static async GetNovelList() {
        const { data, error } = await Server.from("Sfacg-novelInfos").select("*").order("novelId");

        if (error) {
            console.error("Error fetching novelList:", error);
            return null;
        }
        return data as _dbNovels[];
    }

    static async GetChapterIdsByField(
        fieldName: "novelId" | "volumeId" = "novelId",
        fieldValue: number
    ) {
        let startIndex = 0;
        const pageSize = 1000; // 每次查询的行数
        let Ids: number[] = [];
        while (true) {
            const { data, error } = await Server.from("Sfacg-chapter")
                .select("chapId")
                .eq(fieldName, fieldValue)
                .order("chapId")
                .range(startIndex, startIndex + pageSize - 1);

            if (error) {
                console.error(`Error GetChapterIdsByField: ${fieldName}=${fieldValue}`, error);
                return null;
            }
            if (!data || data.length === 0) {
                // 如果没有更多数据，退出循环
                break;
            }
            // 添加当前批次的 IDs 至结果数组
            Ids = Ids.concat(data.map((item) => item.chapId));
            // 如果返回的数据少于 pageSize，说明已经到了最后一页
            if (data.length < pageSize) {
                break;
            }
            // 更新 startIndex 以获取下一个数据批次
            startIndex += pageSize;
        }

        return Ids;
    }
    static async GetAllChapters() {
        let pageIndex = 0;
        const pageSize = 1000;
        let hasMore = true;
        const allData = [];

        while (hasMore) {
            console.log(`正在查询第 ${pageIndex + 1} 页...`); // 添加调试信息

            const { data, error } = await Server.from("Sfacg-chapter")
                .select("content, chapId")
                .range(pageIndex * pageSize, (pageIndex + 1) * pageSize - 1);

            if (error) {
                console.error("查询错误", error);
                break;
            }

            console.log(`第 ${pageIndex + 1} 页返回了 ${data.length} 条数据。`); // 添加调试信息

            // 将这次查询的数据添加到总数据列表中
            allData.push(...data);

            console.log(`目前总数据量: ${allData.length}`); // 添加调试信息

            // 如果这次查询返回的数据少于请求的数量，说明已经到达数据的末尾
            if (data.length < pageSize) {
                hasMore = false;
            } else {
                pageIndex++; // 准备获取下一个数据段
            }
        }

        console.log(`查询完成，总共获取了 ${allData.length} 条数据。`); // 添加调试信息

        return allData;
    }
    static async GetChapterContent(chapId: number) {
        const s3 = new S3();
        return await (await s3.download(`chap/${chapId}.txt`)).Body?.transformToString();
    }
}

// (async () => {
//     const a = await _SfacgCache.GetChapterContent(718547);
//     console.log(a);
// })();
