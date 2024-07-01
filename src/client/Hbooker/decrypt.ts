import * as crypto from "crypto";

const retryCount = 5;
const versionAndroid = "2.9.328";
const versionIos = "3.2.710";
const deviceToken = "ciweimao_";
const deviceIosToken = "iPhone-";
const threadNum = 32;
const apiKey = "zG2nSeEfSHfvTCHy5LCcqtBbQehKNLXn";
const androidUserAgent = `Android com.kuangxiangciweimao.novel ${versionAndroid}`;
const iosUserAgent = `HappyBook/${versionIos} (iPhone; iOS 14.5.1; Scale/2.00)`;
const postContentType = "application/x-www-form-urlencoded";
const ivBase64 = "AAAAAAAAAAAAAAAAAAAAAA==";
const hmacKey = "a90f3731745f1c30ee77cb13fc00005a";
const androidSignaturesKey = "CkMxWNB666";
const iosSignaturesKey = "kuangxiang.HappyBook";
const publicIOSKey = `MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDCohMLlejVLZvmFh/XFG2N5YKAjCeU08hiWUXGTUztFcUnYYhv2J1FknW/FuinK+ojveEYTNpHeXvXBjc7PXVGYLzCt+B4XW7zheehTcE8Wut3IzJd8rnIUbNpqLgqe6Ttu/X46E8wI8Xnkxlluh0wPRPIu+MmqyS1k6+2A6m/tQIDAQAB`;

class Authenticate {
    p?: string;
    app_version: string;
    device_token: string;
    login_token: string;
    account: string;
    refresh: string = "1"; //这俩安卓逻辑不需要
    signatures: string;
    rand_str: string;
    ts: string = Date.now().toString(); //这俩安卓逻辑不需要

    constructor(app_version: string, device_token: string, login_token: string, account: string) {
        this.app_version = app_version;
        this.device_token = device_token;
        this.login_token = login_token;
        this.account = account;
        this.rand_str = crypto.randomBytes(16).toString("hex");
        if (deviceToken.includes("iPhone")) {
            this.refresh = "1";
            this.ts = Date.now().toString();
            this.signatures = iosSignaturesKey;
        } else {
            this.signatures = hmacKey + androidSignaturesKey;
            this.p = crypto
                .createHmac("sha256", hmacKey)
                .update(this.getQueryParams())
                .digest("base64");
        }
    }

    public getQueryParams(): string {
        const query: { [key: string]: any } = JSON.parse(JSON.stringify(this));
        if (this.device_token.includes("iPhone")) {
            delete query.refresh;
            delete query.ts;
        }
        let queryParams = "";
        for (const [k, v] of Object.entries(query)) {
            queryParams += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        }
        return queryParams.substring(1);
    }
}

const test = new Authenticate("2.9.328",deviceToken,"",""); // 补充
console.log(test.p);
