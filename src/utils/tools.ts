import readline from "readline"

export function question(query: any) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            rl.close();
            resolve(answer);
        });

    });

}

// 返回带颜色的字
export function colorize(text: string, color: "blue" | "green" | "purple" | "yellow") {
    const colors = {
        blue: "\x1b[34m",
        green: "\x1b[32m",
        purple: "\x1b[35m",
        yellow: "\x1b[33m"
    };
    return colors[color] + text + "\x1b[0m";
}

// 生成随机昵称
export function RandomName() {
    // 生成随机六位汉字+字母+数字组合的代码
    const random = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min);
    const randomChar = (length: number) => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[random(0, chars.length)];
        }
        return result;
    };
    const randomChinese = (length: number) => {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += String.fromCharCode(random(0x4e00, 0x9fa5));
        }
        return result;
    };
    const randomName = randomChinese(2) + randomChar(4);
    return randomName;
}

// 隐藏手机号
export function Secret(phoneNumber: string) {
    return phoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

// 获得格式化时间xxxx-xx-xx
export function getNowFormatDate(): string {
    const date = new Date();
    const utc8Offset = 8 * 60;
    const now = new Date(date.getTime() + utc8Offset * 60 * 1000);
    const year = now.getUTCFullYear();
    const month = (now.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = now.getUTCDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
}